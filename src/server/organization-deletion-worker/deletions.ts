import type { Prisma, PrismaClient } from "../../../prisma/generated/prisma/client";

import { LOCAL_MEDIA_BUCKET, deleteLocalMediaObject } from "~/server/media/local-storage";
import { deleteR2Object } from "~/server/media/r2-client";

type OrganizationDeletionWorkerDb = PrismaClient;

type ClaimOptions = {
  batchSize: number;
  lockMs: number;
};

type ProcessOptions = {
  maxAttempts: number;
};

type StoredMediaObject = {
  bucket: string;
  storageKey: string;
};

type OrganizationDeletionPlan = {
  mediaAssetIds: string[];
  organizationExists: boolean;
  storedObjects: StoredMediaObject[];
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown organization deletion error.";

const getRetryDelayMs = (attemptCount: number) =>
  Math.min(15 * 60 * 1000, 30 * 1000 * 2 ** Math.max(0, attemptCount - 1));

const uniqueStoredObjects = (objects: StoredMediaObject[]) => {
  const seen = new Set<string>();

  return objects.filter((object) => {
    const key = `${object.bucket}:${object.storageKey}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const isStoredMediaObject = (value: unknown): value is StoredMediaObject =>
  typeof value === "object" &&
  value !== null &&
  "bucket" in value &&
  "storageKey" in value &&
  typeof value.bucket === "string" &&
  typeof value.storageKey === "string";

const parseStoredMediaObjects = (value: unknown) =>
  Array.isArray(value) ? value.filter(isStoredMediaObject) : [];

const storedMediaObjectsToJson = (objects: StoredMediaObject[]) =>
  objects.map((object) => ({
    bucket: object.bucket,
    storageKey: object.storageKey
  })) as Prisma.InputJsonValue;

const getMediaOwnerFilters = ({
  organizationId,
  staffMemberIds,
  submissionIds
}: {
  organizationId: string;
  staffMemberIds: string[];
  submissionIds: string[];
}) => [
  {
    owner_id: organizationId,
    owner_type: "ORGANIZATION" as const
  },
  ...(staffMemberIds.length > 0
    ? [
        {
          owner_id: {
            in: staffMemberIds
          },
          owner_type: "STAFF_MEMBER" as const
        }
      ]
    : []),
  ...(submissionIds.length > 0
    ? [
        {
          owner_id: {
            in: submissionIds
          },
          owner_type: "SUBMISSION" as const
        }
      ]
    : [])
];

const deleteStoredMediaObject = async ({ bucket, storageKey }: StoredMediaObject) => {
  if (bucket === LOCAL_MEDIA_BUCKET) {
    await deleteLocalMediaObject(storageKey);
    return;
  }

  await deleteR2Object(storageKey);
};

const runWithConcurrency = async <T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>
) => {
  const failed: unknown[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];

        nextIndex += 1;

        try {
          await task(item);
        } catch (error) {
          failed.push(error);
        }
      }
    })
  );

  return failed;
};

export const claimPendingOrganizationDeletionJobs = async (
  db: OrganizationDeletionWorkerDb,
  { batchSize, lockMs }: ClaimOptions
) => {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + lockMs);
  const candidates = await db.organizationDeletionJob.findMany({
    orderBy: {
      created_at: "asc"
    },
    select: {
      id: true
    },
    take: batchSize,
    where: {
      next_attempt_at: {
        lte: now
      },
      OR: [
        {
          locked_until: null
        },
        {
          locked_until: {
            lt: now
          }
        }
      ],
      status: "PENDING"
    }
  });
  const claimedIds: string[] = [];

  for (const candidate of candidates) {
    const result = await db.organizationDeletionJob.updateMany({
      data: {
        attempt_count: {
          increment: 1
        },
        error: null,
        locked_until: lockUntil,
        started_at: now
      },
      where: {
        id: candidate.id,
        next_attempt_at: {
          lte: now
        },
        OR: [
          {
            locked_until: null
          },
          {
            locked_until: {
              lt: now
            }
          }
        ],
        status: "PENDING"
      }
    });

    if (result.count === 1) {
      claimedIds.push(candidate.id);
    }
  }

  return claimedIds;
};

const collectOrganizationDeletionPlan = async (
  db: OrganizationDeletionWorkerDb,
  organizationId: string
): Promise<OrganizationDeletionPlan> => {
  const organization = await db.organization.findUnique({
    select: {
      id: true
    },
    where: {
      id: organizationId
    }
  });

  if (!organization) {
    return {
      mediaAssetIds: [],
      organizationExists: false,
      storedObjects: []
    };
  }

  const [staffMembers, submissions] = await Promise.all([
    db.staffMember.findMany({
      select: {
        id: true
      },
      where: {
        organization_id: organization.id
      }
    }),
    db.submission.findMany({
      select: {
        id: true
      },
      where: {
        organization_id: organization.id
      }
    })
  ]);
  const staffMemberIds = staffMembers.map((item) => item.id);
  const submissionIds = submissions.map((item) => item.id);
  const mediaOwnerFilters = getMediaOwnerFilters({
    organizationId: organization.id,
    staffMemberIds,
    submissionIds
  });
  const mediaAssets = await db.mediaAsset.findMany({
    select: {
      bucket: true,
      id: true,
      storage_key: true
    },
    where: {
      OR: mediaOwnerFilters
    }
  });
  const storedObjects = uniqueStoredObjects([
    ...mediaAssets.map((asset) => ({
      bucket: asset.bucket,
      storageKey: asset.storage_key
    }))
  ]);

  return {
    mediaAssetIds: mediaAssets.map((asset) => asset.id),
    organizationExists: true,
    storedObjects
  };
};

const deleteOrganizationRecords = async (
  db: OrganizationDeletionWorkerDb,
  {
    mediaAssetIds,
    organizationId
  }: {
    mediaAssetIds: string[];
    organizationId: string;
  }
) => {
  await db.$transaction(async (tx) => {
    if (mediaAssetIds.length > 0) {
      await tx.submissionAttachment.deleteMany({
        where: {
          media_asset_id: {
            in: mediaAssetIds
          }
        }
      });

      await tx.mediaAsset.deleteMany({
        where: {
          id: {
            in: mediaAssetIds
          }
        }
      });
    }

    await tx.organization.deleteMany({
      where: {
        id: organizationId
      }
    });
  });
};

const deleteStoredMediaObjects = async (storedObjects: StoredMediaObject[]) => {
  const failed = await runWithConcurrency(storedObjects, 8, deleteStoredMediaObject);

  if (failed.length > 0) {
    throw new Error(`Failed to delete ${failed.length} organization media object(s).`);
  }
};

const markOrganizationDeletionJobDone = async (
  db: OrganizationDeletionWorkerDb,
  { jobId }: { jobId: string }
) => {
  await db.organizationDeletionJob.update({
    data: {
      completed_at: new Date(),
      error: null,
      locked_until: null,
      status: "DONE"
    },
    where: {
      id: jobId
    }
  });
};

const markOrganizationDeletionJobFailed = async (
  db: OrganizationDeletionWorkerDb,
  {
    error,
    jobId
  }: {
    error: unknown;
    jobId: string;
  }
) => {
  await db.organizationDeletionJob.update({
    data: {
      error: getErrorMessage(error),
      failed_at: new Date(),
      locked_until: null,
      status: "FAILED"
    },
    where: {
      id: jobId
    }
  });
};

const scheduleOrganizationDeletionJobRetry = async (
  db: OrganizationDeletionWorkerDb,
  {
    error,
    jobId
  }: {
    error: unknown;
    jobId: string;
  }
) => {
  const job = await db.organizationDeletionJob.findUnique({
    select: {
      attempt_count: true
    },
    where: {
      id: jobId
    }
  });
  const attemptCount = job?.attempt_count ?? 1;

  await db.organizationDeletionJob.update({
    data: {
      error: getErrorMessage(error),
      locked_until: null,
      next_attempt_at: new Date(Date.now() + getRetryDelayMs(attemptCount)),
      status: "PENDING"
    },
    where: {
      id: jobId
    }
  });
};

export const processOrganizationDeletionJob = async (
  db: OrganizationDeletionWorkerDb,
  jobId: string,
  { maxAttempts }: ProcessOptions
) => {
  try {
    const job = await db.organizationDeletionJob.findUnique({
      select: {
        organization_id: true,
        storage_objects: true
      },
      where: {
        id: jobId
      }
    });

    if (!job) {
      return;
    }

    let storedObjects = parseStoredMediaObjects(job.storage_objects);

    if (job.organization_id) {
      const plan = await collectOrganizationDeletionPlan(db, job.organization_id);

      if (plan.organizationExists) {
        storedObjects = plan.storedObjects;

        await db.organizationDeletionJob.update({
          data: {
            storage_objects: storedMediaObjectsToJson(storedObjects)
          },
          where: {
            id: jobId
          }
        });

        await deleteOrganizationRecords(db, {
          mediaAssetIds: plan.mediaAssetIds,
          organizationId: job.organization_id
        });
      }
    }

    await deleteStoredMediaObjects(storedObjects);
    await markOrganizationDeletionJobDone(db, {
      jobId
    });
  } catch (error) {
    const job = await db.organizationDeletionJob.findUnique({
      select: {
        attempt_count: true
      },
      where: {
        id: jobId
      }
    });

    if (!job) {
      return;
    }

    if (job.attempt_count >= maxAttempts) {
      await markOrganizationDeletionJobFailed(db, {
        error,
        jobId
      });
      return;
    }

    await scheduleOrganizationDeletionJobRetry(db, {
      error,
      jobId
    });
  }
};

export const processPendingOrganizationDeletionJobsOnce = async (
  db: OrganizationDeletionWorkerDb,
  { batchSize, lockMs, maxAttempts }: ClaimOptions & ProcessOptions
) => {
  const claimedIds = await claimPendingOrganizationDeletionJobs(db, {
    batchSize,
    lockMs
  });

  await Promise.all(
    claimedIds.map((jobId) =>
      processOrganizationDeletionJob(db, jobId, {
        maxAttempts
      })
    )
  );

  return claimedIds.length;
};
