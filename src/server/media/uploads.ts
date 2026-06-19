import type {
  MediaAssetKind,
  MediaOwnerType,
  Prisma
} from "../../../prisma/generated/prisma/client";
import { randomUUID } from "node:crypto";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import {
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_UPLOAD_EXPIRES_IN_SECONDS,
  isSupportedImageContentType
} from "./constants";
import { buildFinalStorageKey, buildTempStorageKey } from "./keys";
import {
  LOCAL_MEDIA_BUCKET,
  deleteLocalMediaObject,
  getLocalMediaObjectBuffer,
  getLocalUploadUrl,
  headLocalMediaObject,
  putLocalMediaObject,
  shouldUseLocalMediaStorage
} from "./local-storage";
import {
  deleteR2Object,
  getR2Config,
  getR2Object,
  headR2Object,
  putR2Object,
  createPresignedPutUrl
} from "./r2-client";
import {
  getMediaChecksum,
  processLogoImage,
  processSubmissionPhoto,
  streamToBuffer,
  type ProcessedImage
} from "./processing";

type CreateMediaUploadSessionInput = {
  contentType: string;
  fileName: string;
  kind: MediaAssetKind;
  ownerId: string;
  ownerType: MediaOwnerType;
  userId?: string;
};

type FinalizeMediaUploadSessionInput = {
  sessionId: string;
};

const getSizeLimitBytes = () => MEDIA_IMAGE_MAX_BYTES;
const waitForFinalizeRetryMs = 250;
const waitForFinalizeAttempts = 20;

const assertUploadKindIsImage = (kind: MediaAssetKind) => {
  if (kind !== "ORGANIZATION_LOGO" && kind !== "STAFF_AVATAR" && kind !== "SUBMISSION_PHOTO") {
    throw new Error("This media kind cannot be uploaded through the image upload flow.");
  }
};

const addSeconds = (date: Date, seconds: number) => new Date(date.getTime() + seconds * 1000);

const createAssetRecordInput = ({
  asset,
  bucket,
  kind,
  ownerId,
  ownerType,
  publicUrl,
  sessionId,
  storageKey
}: {
  asset: ProcessedImage;
  bucket: string;
  kind: MediaAssetKind;
  ownerId: string;
  ownerType: MediaOwnerType;
  publicUrl: string;
  sessionId: string;
  storageKey: string;
}): Prisma.MediaAssetCreateManyInput => ({
  bucket,
  checksum: getMediaChecksum(asset.body),
  content_type: asset.contentType,
  height: asset.height,
  kind,
  metadata: {},
  owner_id: ownerId,
  owner_type: ownerType,
  public_url: publicUrl,
  size_bytes: asset.sizeBytes,
  status: "READY",
  storage_key: storageKey,
  upload_session_id: sessionId,
  width: asset.width
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getFinalizedMediaAssets = (sessionId: string, db: DomainDb) =>
  db.mediaAsset.findMany({
    orderBy: {
      created_at: "asc"
    },
    where: {
      upload_session_id: sessionId
    }
  });

const waitForFinalizedMediaAssets = async (sessionId: string, db: DomainDb) => {
  for (let attempt = 0; attempt < waitForFinalizeAttempts; attempt += 1) {
    const session = await db.mediaUploadSession.findUnique({
      select: {
        last_error: true,
        status: true
      },
      where: {
        id: sessionId
      }
    });

    if (!session) {
      throw new Error("Upload session was not found or has expired.");
    }

    if (session.status === "READY") {
      return getFinalizedMediaAssets(sessionId, db);
    }

    if (session.status === "FAILED") {
      throw new Error(session.last_error || "Upload finalization failed.");
    }

    if (session.status !== "PROCESSING") {
      throw new Error("Upload session is not ready to be finalized.");
    }

    await sleep(waitForFinalizeRetryMs);
  }

  throw new Error("Upload session is still being finalized.");
};

export const createMediaUploadSession = async (
  input: CreateMediaUploadSessionInput,
  db: DomainDb = getDomainDb()
) => {
  assertUploadKindIsImage(input.kind);

  if (!isSupportedImageContentType(input.contentType)) {
    throw new Error("Only JPEG, PNG, and WebP images are supported.");
  }

  const now = new Date();
  const useLocalStorage = shouldUseLocalMediaStorage();
  const bucket = useLocalStorage ? LOCAL_MEDIA_BUCKET : getR2Config().bucket;
  const sessionId = randomUUID();
  const tempStorageKey = buildTempStorageKey(sessionId);
  const expiresAt = addSeconds(now, MEDIA_UPLOAD_EXPIRES_IN_SECONDS);
  const sizeLimitBytes = getSizeLimitBytes();

  const uploadUrl = useLocalStorage
    ? getLocalUploadUrl(sessionId)
    : await createPresignedPutUrl({
        contentType: input.contentType,
        expiresIn: MEDIA_UPLOAD_EXPIRES_IN_SECONDS,
        key: tempStorageKey
      });

  const session = await db.mediaUploadSession.create({
    data: {
      bucket,
      content_type: input.contentType,
      expires_at: expiresAt,
      file_name: input.fileName,
      id: sessionId,
      kind: input.kind,
      owner_id: input.ownerId,
      owner_type: input.ownerType,
      size_limit_bytes: sizeLimitBytes,
      temp_storage_key: tempStorageKey,
      user_id: input.userId
    }
  });

  return {
    expiresAt,
    headers: {
      "Content-Type": input.contentType
    },
    maxBytes: sizeLimitBytes,
    method: "PUT" as const,
    session,
    uploadUrl
  };
};

export const finalizeMediaUploadSession = async (
  input: FinalizeMediaUploadSessionInput,
  db: DomainDb = getDomainDb()
) => {
  const session = await db.mediaUploadSession.findUnique({
    where: {
      id: input.sessionId
    }
  });

  if (!session || session.expires_at <= new Date()) {
    throw new Error("Upload session was not found or has expired.");
  }

  if (session.status === "READY") {
    return getFinalizedMediaAssets(session.id, db);
  }

  if (session.status === "FAILED") {
    throw new Error(session.last_error || "Upload finalization failed.");
  }

  if (
    session.status !== "PENDING" &&
    session.status !== "UPLOADED" &&
    session.status !== "PROCESSING"
  ) {
    throw new Error("Upload session is not ready to be finalized.");
  }

  const claimed = await db.mediaUploadSession.updateMany({
    data: {
      status: "PROCESSING",
      uploaded_at: new Date()
    },
    where: {
      id: session.id,
      status: {
        in: ["PENDING", "UPLOADED"]
      }
    }
  });

  if (claimed.count === 0) {
    return waitForFinalizedMediaAssets(session.id, db);
  }

  try {
    const useLocalStorage = session.bucket === LOCAL_MEDIA_BUCKET;
    const head = useLocalStorage
      ? await headLocalMediaObject(session.temp_storage_key)
      : await headR2Object(session.temp_storage_key);
    const sizeBytes = Number(head.ContentLength ?? 0);

    if (!sizeBytes || sizeBytes > session.size_limit_bytes) {
      throw new Error("Uploaded file is empty or too large.");
    }

    if (head.ContentType && head.ContentType !== session.content_type) {
      throw new Error("Uploaded file content type does not match the upload session.");
    }

    const body = useLocalStorage
      ? await getLocalMediaObjectBuffer(session.temp_storage_key)
      : await getR2Object(session.temp_storage_key).then((object) => streamToBuffer(object.Body));
    const finalAssets: Prisma.MediaAssetCreateManyInput[] = [];

    if (session.kind === "SUBMISSION_PHOTO") {
      const processed = await processSubmissionPhoto(body);
      const mainKey = buildFinalStorageKey({
        extension: processed.main.extension,
        kind: "SUBMISSION_PHOTO",
        ownerId: session.owner_id,
        ownerType: session.owner_type,
        variant: "main"
      });
      const thumbnailKey = buildFinalStorageKey({
        extension: processed.thumbnail.extension,
        kind: "SUBMISSION_THUMBNAIL",
        ownerId: session.owner_id,
        ownerType: session.owner_type,
        variant: "thumb"
      });
      const mainObject = useLocalStorage
        ? await putLocalMediaObject({
            body: processed.main.body,
            contentType: processed.main.contentType,
            key: mainKey
          })
        : await putR2Object({
            body: processed.main.body,
            contentType: processed.main.contentType,
            key: mainKey
          });
      const thumbnailObject = useLocalStorage
        ? await putLocalMediaObject({
            body: processed.thumbnail.body,
            contentType: processed.thumbnail.contentType,
            key: thumbnailKey
          })
        : await putR2Object({
            body: processed.thumbnail.body,
            contentType: processed.thumbnail.contentType,
            key: thumbnailKey
          });

      finalAssets.push(
        createAssetRecordInput({
          asset: processed.main,
          bucket: mainObject.bucket,
          kind: "SUBMISSION_PHOTO",
          ownerId: session.owner_id,
          ownerType: session.owner_type,
          publicUrl: mainObject.publicUrl,
          sessionId: session.id,
          storageKey: mainObject.storageKey
        }),
        createAssetRecordInput({
          asset: processed.thumbnail,
          bucket: thumbnailObject.bucket,
          kind: "SUBMISSION_THUMBNAIL",
          ownerId: session.owner_id,
          ownerType: session.owner_type,
          publicUrl: thumbnailObject.publicUrl,
          sessionId: session.id,
          storageKey: thumbnailObject.storageKey
        })
      );
    } else {
      const processed = await processLogoImage(body);
      const finalKey = buildFinalStorageKey({
        extension: processed.extension,
        kind: session.kind,
        ownerId: session.owner_id,
        ownerType: session.owner_type
      });
      const finalObject = useLocalStorage
        ? await putLocalMediaObject({
            body: processed.body,
            contentType: processed.contentType,
            key: finalKey
          })
        : await putR2Object({
            body: processed.body,
            contentType: processed.contentType,
            key: finalKey
          });

      finalAssets.push(
        createAssetRecordInput({
          asset: processed,
          bucket: finalObject.bucket,
          kind: session.kind,
          ownerId: session.owner_id,
          ownerType: session.owner_type,
          publicUrl: finalObject.publicUrl,
          sessionId: session.id,
          storageKey: finalObject.storageKey
        })
      );
    }

    await (
      useLocalStorage
        ? deleteLocalMediaObject(session.temp_storage_key)
        : deleteR2Object(session.temp_storage_key)
    ).catch(() => undefined);

    const finalized = await db.$transaction(async (tx) => {
      await tx.mediaAsset.createMany({
        data: finalAssets
      });

      await tx.mediaUploadSession.update({
        data: {
          final_storage_key: finalAssets[0]?.storage_key,
          processed_at: new Date(),
          status: "READY"
        },
        where: {
          id: session.id
        }
      });

      return tx.mediaAsset.findMany({
        orderBy: {
          created_at: "asc"
        },
        where: {
          upload_session_id: session.id
        }
      });
    });

    return finalized;
  } catch (error) {
    await db.mediaUploadSession.update({
      data: {
        failed_at: new Date(),
        last_error: error instanceof Error ? error.message : "Unknown media processing error.",
        status: "FAILED"
      },
      where: {
        id: session.id
      }
    });

    throw error;
  }
};
