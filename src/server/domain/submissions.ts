import type {
  MediaAssetKind,
  Prisma,
  SubmissionKind
} from "../../../prisma/generated/prisma/client";

import { enqueueSubmissionNotifications } from "~/server/domain/notification-deliveries";
import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { isOrganizationSubscriptionActive } from "~/server/domain/subscriptions";
import { SUBMISSION_PHOTO_LIMIT } from "~/server/media";
import { DEFAULT_GUEST_MENU_ENABLED_BY_ID } from "~/shared/guest-menu";
import {
  parseModuleSettingsConfig,
  type ComplaintModuleSettings,
  type ReviewModuleSettings,
  type SuggestionModuleSettings
} from "~/shared/module-settings";
import {
  type AdminSubmissionCounts,
  safeParseSubmissionMetadata,
  parseSubmissionMetadata,
  type AdminSubmissionItem,
  type AdminSubmissionsPayload,
  type SubmissionMetadata
} from "~/shared/submissions";
import { DEFAULT_LOCALE, fromPrismaLocale, type AppLocale } from "~/shared/i18n";

type CreateSubmissionInput = {
  attachmentMediaAssetIds?: string[];
  attachmentOwnerId?: string;
  bodyText?: string;
  customerAllowsReply?: boolean;
  customerContactPhone?: string;
  customerDisplayName?: string;
  customerUserId?: string;
  kind: SubmissionKind;
  locale?: AppLocale;
  metadata?: SubmissionMetadata;
  organizationId: string;
  qrContext?: string;
  rating?: number;
  targetStaffMemberId?: string;
};

type GetOrganizationSubmissionsInput = {
  cursor?: string;
  kind?: SubmissionKind;
  limit?: number;
  organizationId: string;
};

const ADMIN_SUBMISSIONS_DEFAULT_LIMIT = 24;
const ADMIN_SUBMISSIONS_MAX_LIMIT = 50;

const kindToModule = (kind: SubmissionKind) =>
  kind === "REVIEW" ? "REVIEW" : kind === "COMPLAINT" ? "COMPLAINT" : "SUGGESTION";

const kindToItemId = (kind: SubmissionKind) =>
  kind === "REVIEW" ? "review" : kind === "COMPLAINT" ? "complaint" : "suggestion";

const normalizeOptionalString = (value: string | undefined) => {
  const normalized = value?.replace(/\s+/g, " ").trim();

  return normalized || undefined;
};

const assertRating = (kind: SubmissionKind, rating?: number) => {
  if (kind !== "REVIEW" && rating !== undefined) {
    throw new Error("Only review submissions can include a rating.");
  }

  if (kind === "REVIEW" && (!rating || rating < 1 || rating > 5)) {
    throw new Error("Review rating must be between 1 and 5.");
  }
};

const assertSubmissionAvailability = async ({
  kind,
  metadata,
  organizationId,
  targetStaffMemberId,
  db
}: {
  kind: SubmissionKind;
  metadata: SubmissionMetadata;
  organizationId: string;
  targetStaffMemberId?: string;
  db: DomainDb;
}) => {
  let staffTargetSnapshot: SubmissionMetadata["staffTargetSnapshot"];
  const organization = await db.organization.findUnique({
    include: {
      module_settings: true,
      subscription: true
    },
    where: {
      id: organizationId
    }
  });

  if (!organization || organization.status !== "ACTIVE") {
    throw new Error("Organization is not available.");
  }

  if (
    organization.subscription !== undefined &&
    !isOrganizationSubscriptionActive(organization.subscription)
  ) {
    throw new Error("Organization subscription is inactive.");
  }

  const itemId = kindToItemId(kind);
  const module = kindToModule(kind);
  const orgSetting = organization.module_settings.find((setting) => setting.module === module);
  const enabled = orgSetting?.enabled ?? true;

  if (!enabled) {
    throw new Error("This submission module is disabled for the organization.");
  }

  const staffTargetType = metadata.staffTargetType ?? "none";

  if (kind === "SUGGESTION") {
    if (targetStaffMemberId || staffTargetType !== "none") {
      throw new Error("Staff targeting is available only for reviews and complaints.");
    }
  } else {
    const staffSetting = organization.module_settings.find((setting) => setting.module === "STAFF");
    const staffEnabled = staffSetting?.enabled ?? DEFAULT_GUEST_MENU_ENABLED_BY_ID.staff;
    const staffSettings = parseModuleSettingsConfig({
      config: staffSetting?.config,
      itemId: "staff"
    });

    if (!staffEnabled && (targetStaffMemberId || staffTargetType !== "none")) {
      throw new Error("Staff targeting is disabled for the organization.");
    }

    if (staffEnabled && targetStaffMemberId) {
      if (staffTargetType !== "none" && staffTargetType !== "employee") {
        throw new Error("Staff target metadata does not match selected staff member.");
      }

      if (!staffSettings.guestSelectionEnabled) {
        throw new Error("Staff member selection is disabled for the organization.");
      }

      const staffMember = await db.staffMember.findFirst({
        select: {
          avatar_media_asset_id: true,
          display_name: true,
          id: true,
          role_title: true
        },
        where: {
          id: targetStaffMemberId,
          is_active: true,
          organization_id: organization.id
        }
      });

      if (!staffMember) {
        throw new Error("Staff member is not available.");
      }

      const avatarAsset = staffMember.avatar_media_asset_id
        ? await db.mediaAsset.findFirst({
            select: {
              public_url: true
            },
            where: {
              id: staffMember.avatar_media_asset_id,
              kind: "STAFF_AVATAR",
              status: "READY"
            }
          })
        : null;

      if (typeof staffMember.display_name === "string" && staffMember.display_name.trim()) {
        staffTargetSnapshot = {
          avatarUrl: avatarAsset?.public_url ?? null,
          displayName: staffMember.display_name,
          id: staffMember.id,
          roleTitle: staffMember.role_title
        };
      }
    } else if (staffEnabled) {
      if (staffTargetType === "employee") {
        throw new Error("Staff member is required for this organization.");
      }

      if (staffTargetType === "team" && !staffSettings.allowTeamReview) {
        throw new Error("Team review is disabled for this organization.");
      }

      if (staffTargetType === "unknown" && !staffSettings.guestSelectionEnabled) {
        throw new Error("Staff member selection is disabled for the organization.");
      }

      if (staffSettings.guestSelectionEnabled && !staffSettings.allowTeamReview) {
        const activeStaffCount = await db.staffMember.count({
          where: {
            is_active: true,
            organization_id: organization.id
          }
        });

        if (activeStaffCount > 0 && staffTargetType !== "unknown") {
          throw new Error("Staff member is required for this organization.");
        }
      }
    }
  }

  return {
    organization,
    settings: parseModuleSettingsConfig({
      config: orgSetting?.config,
      itemId
    }),
    staffTargetSnapshot
  };
};

const getBodyRequired = ({
  bodyText,
  kind,
  rating,
  settings
}: {
  bodyText: string;
  kind: SubmissionKind;
  rating?: number;
  settings: ComplaintModuleSettings | ReviewModuleSettings | SuggestionModuleSettings;
}) => {
  if (kind === "SUGGESTION") {
    return !bodyText;
  }

  if (kind === "COMPLAINT") {
    return (settings as ComplaintModuleSettings).commentRequired && !bodyText;
  }

  const reviewSettings = settings as ReviewModuleSettings;

  return (
    !bodyText &&
    (reviewSettings.commentRequired ||
      (reviewSettings.lowRatingCommentEnabled &&
        typeof rating === "number" &&
        rating <= reviewSettings.lowRatingThreshold))
  );
};

const assertContentRules = ({
  attachmentCount,
  bodyText,
  contactPhone,
  kind,
  metadata,
  rating,
  settings
}: {
  attachmentCount: number;
  bodyText: string;
  contactPhone?: string;
  kind: SubmissionKind;
  metadata: SubmissionMetadata;
  rating?: number;
  settings: ComplaintModuleSettings | ReviewModuleSettings | SuggestionModuleSettings;
}) => {
  if (
    getBodyRequired({
      bodyText,
      kind,
      rating,
      settings
    })
  ) {
    throw new Error("Submission text is required for this organization.");
  }

  if (kind === "COMPLAINT") {
    const complaintSettings = settings as ComplaintModuleSettings;
    const categoryIds = metadata.complaintCategoryIds ?? [];
    const allowedCategoryIds = new Set(complaintSettings.complaintCategoryIds);

    if (!complaintSettings.categoriesEnabled && categoryIds.length > 0) {
      throw new Error("Complaint topics are disabled for this organization.");
    }

    if (categoryIds.some((categoryId) => !allowedCategoryIds.has(categoryId))) {
      throw new Error("Complaint topic is not available.");
    }

    if (!bodyText && categoryIds.length === 0 && attachmentCount === 0) {
      throw new Error("Complaint needs at least one detail.");
    }

    if (complaintSettings.contactEnabled && complaintSettings.contactRequired && !contactPhone) {
      throw new Error("Contact is required for this organization.");
    }
  }

  if (kind === "SUGGESTION") {
    const suggestionSettings = settings as SuggestionModuleSettings;
    const topicIds = metadata.suggestionTopicIds ?? [];
    const allowedTopicIds = new Set(suggestionSettings.suggestionTopicIds);

    if (!suggestionSettings.categoriesEnabled && topicIds.length > 0) {
      throw new Error("Suggestion topics are disabled for this organization.");
    }

    if (topicIds.some((topicId) => !allowedTopicIds.has(topicId))) {
      throw new Error("Suggestion topic is not available.");
    }

    if (suggestionSettings.contactEnabled && suggestionSettings.contactRequired && !contactPhone) {
      throw new Error("Contact is required for this organization.");
    }
  }

  if (kind === "REVIEW") {
    if ((metadata.complaintCategoryIds?.length ?? 0) > 0) {
      throw new Error("Complaint topics are available only for complaints.");
    }

    if ((metadata.suggestionTopicIds?.length ?? 0) > 0) {
      throw new Error("Suggestion topics are available only for suggestions.");
    }
  }
};

const assertAttachments = async ({
  attachmentMediaAssetIds,
  db,
  ownerId
}: {
  attachmentMediaAssetIds: string[];
  db: DomainDb;
  ownerId?: string;
}) => {
  if (attachmentMediaAssetIds.length > SUBMISSION_PHOTO_LIMIT) {
    throw new Error(`Submissions can include up to ${SUBMISSION_PHOTO_LIMIT} photos.`);
  }

  if (attachmentMediaAssetIds.length === 0) {
    return [];
  }

  const assets = await db.mediaAsset.findMany({
    select: {
      id: true,
      upload_session_id: true
    },
    where: {
      id: {
        in: attachmentMediaAssetIds
      },
      kind: "SUBMISSION_PHOTO" satisfies MediaAssetKind,
      ...(ownerId ? { owner_id: ownerId } : {}),
      status: "READY"
    }
  });

  if (assets.length !== attachmentMediaAssetIds.length) {
    throw new Error("One or more submission photos are not ready.");
  }

  return assets;
};

const enqueueSubmissionNotificationsBestEffort = async (
  {
    kind,
    organizationId,
    rating,
    submissionId
  }: {
    kind: SubmissionKind;
    organizationId: string;
    rating?: null | number;
    submissionId: string;
  },
  db: DomainDb
) => {
  try {
    await enqueueSubmissionNotifications(
      {
        kind,
        organizationId,
        rating,
        submissionId
      },
      db
    );
  } catch {
    // Submission creation must stay fast for guests. The dispatcher handles queued deliveries.
  }
};

export const toAdminSubmissionItem = (submission: {
  attachments: Array<{
    id: string;
    media_asset: {
      public_url: string;
    };
    sort_order: number;
  }>;
  body_text: string;
  created_at: Date;
  customer_allows_reply: boolean;
  customer_contact_phone: null | string;
  customer_display_name: null | string;
  id: string;
  kind: SubmissionKind;
  locale: string;
  metadata: unknown;
  qr_context: null | string;
  rating: null | number;
  target_staff_member: null | {
    display_name: string;
    id: string;
    role_title: string;
  };
}): AdminSubmissionItem => {
  const metadata = safeParseSubmissionMetadata(submission.metadata);
  const snapshot = metadata.staffTargetSnapshot;

  return {
    attachments: submission.attachments.map((attachment) => ({
      id: attachment.id,
      publicUrl: attachment.media_asset.public_url,
      sortOrder: attachment.sort_order
    })),
    bodyText: submission.body_text,
    createdAt: submission.created_at.toISOString(),
    customerAllowsReply: submission.customer_allows_reply,
    customerContactPhone: submission.customer_contact_phone,
    customerDisplayName: submission.customer_display_name,
    id: submission.id,
    kind: submission.kind,
    locale: fromPrismaLocale(submission.locale),
    metadata,
    qrContext: submission.qr_context,
    rating: submission.rating,
    targetStaffMember: submission.target_staff_member
      ? {
          displayName: submission.target_staff_member.display_name,
          id: submission.target_staff_member.id,
          roleTitle: submission.target_staff_member.role_title
        }
      : snapshot
        ? {
            displayName: snapshot.displayName,
            id: snapshot.id,
            roleTitle: snapshot.roleTitle ?? ""
          }
        : null
  };
};

export const getOrganizationSubmissions = async (
  {
    cursor,
    kind,
    limit = ADMIN_SUBMISSIONS_DEFAULT_LIMIT,
    organizationId
  }: GetOrganizationSubmissionsInput,
  db: DomainDb = getDomainDb()
): Promise<AdminSubmissionsPayload> => {
  const take = Math.min(
    Math.max(Math.trunc(limit) || ADMIN_SUBMISSIONS_DEFAULT_LIMIT, 1),
    ADMIN_SUBMISSIONS_MAX_LIMIT
  );
  const organization = await db.organization.findUnique({
    select: {
      id: true,
      status: true
    },
    where: {
      id: organizationId
    }
  });

  if (!organization || organization.status !== "ACTIVE") {
    throw new Error("Organization is not available.");
  }

  const where: Prisma.SubmissionWhereInput = {
    organization_id: organization.id,
    ...(kind ? { kind } : {})
  };
  const countsWhere: Prisma.SubmissionWhereInput = {
    organization_id: organization.id
  };

  const [items, total, reviewCount, complaintCount, suggestionCount] = await Promise.all([
    db.submission.findMany({
      ...(cursor
        ? {
            cursor: {
              id: cursor
            },
            skip: 1
          }
        : {}),
      include: {
        attachments: {
          include: {
            media_asset: {
              select: {
                public_url: true
              }
            }
          },
          orderBy: {
            sort_order: "asc"
          },
          take: 4
        },
        target_staff_member: {
          select: {
            display_name: true,
            id: true,
            role_title: true
          }
        }
      },
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: take + 1,
      where
    }),
    db.submission.count({
      where
    }),
    db.submission.count({
      where: {
        ...countsWhere,
        kind: "REVIEW"
      }
    }),
    db.submission.count({
      where: {
        ...countsWhere,
        kind: "COMPLAINT"
      }
    }),
    db.submission.count({
      where: {
        ...countsWhere,
        kind: "SUGGESTION"
      }
    })
  ]);
  const visibleItems = items.slice(0, take);
  const hasNextPage = items.length > take;
  const counts: AdminSubmissionCounts = {
    ALL: reviewCount + complaintCount + suggestionCount,
    COMPLAINT: complaintCount,
    REVIEW: reviewCount,
    SUGGESTION: suggestionCount
  };

  return {
    counts,
    items: visibleItems.map(toAdminSubmissionItem),
    nextCursor: hasNextPage ? (visibleItems.at(-1)?.id ?? null) : null,
    organizationId: organization.id,
    total
  };
};

export const getSubmissionAdminItem = async (
  submissionId: string,
  db: DomainDb = getDomainDb()
): Promise<AdminSubmissionItem> => {
  const submission = await db.submission.findUnique({
    include: {
      attachments: {
        include: {
          media_asset: {
            select: {
              public_url: true
            }
          }
        },
        orderBy: {
          sort_order: "asc"
        },
        take: 4
      },
      target_staff_member: {
        select: {
          display_name: true,
          id: true,
          role_title: true
        }
      }
    },
    where: {
      id: submissionId
    }
  });

  if (!submission) {
    throw new Error("Submission is not available.");
  }

  return toAdminSubmissionItem(submission);
};

export const createSubmission = async (
  input: CreateSubmissionInput,
  db: DomainDb = getDomainDb()
) => {
  assertRating(input.kind, input.rating);
  const metadata = parseSubmissionMetadata(input.metadata);

  const { organization, settings, staffTargetSnapshot } = await assertSubmissionAvailability({
    db,
    kind: input.kind,
    metadata,
    organizationId: input.organizationId,
    targetStaffMemberId: input.targetStaffMemberId
  });
  const bodyText = input.bodyText?.trim() ?? "";
  const contactPhone = normalizeOptionalString(input.customerContactPhone);
  const customerDisplayName = normalizeOptionalString(input.customerDisplayName);

  assertContentRules({
    attachmentCount: input.attachmentMediaAssetIds?.length ?? 0,
    bodyText,
    contactPhone,
    kind: input.kind,
    metadata,
    rating: input.rating,
    settings
  });

  const attachmentAssets = await assertAttachments({
    attachmentMediaAssetIds: input.attachmentMediaAssetIds ?? [],
    db,
    ownerId: input.attachmentOwnerId
  });
  const attachmentIds = input.attachmentMediaAssetIds ?? [];
  const metadataWithSnapshot = staffTargetSnapshot
    ? {
        ...metadata,
        staffTargetSnapshot
      }
    : metadata;

  const submission = await db.submission.create({
    data: {
      attachments: {
        create: attachmentIds.map((mediaAssetId, index) => ({
          media_asset_id: mediaAssetId,
          sort_order: index
        }))
      },
      body_text: bodyText,
      customer_allows_reply: Boolean(input.customerAllowsReply && contactPhone),
      customer_contact_phone: contactPhone,
      customer_display_name: customerDisplayName,
      customer_user_id: input.customerUserId,
      kind: input.kind,
      locale: input.locale ?? DEFAULT_LOCALE,
      metadata: metadataWithSnapshot as Prisma.InputJsonObject,
      organization_id: organization.id,
      qr_context: input.qrContext,
      rating: input.rating,
      target_staff_member_id: input.targetStaffMemberId
    }
  });

  const uploadSessionIds = attachmentAssets
    .map((asset) => asset.upload_session_id)
    .filter((value): value is string => Boolean(value));

  if (attachmentIds.length > 0 || uploadSessionIds.length > 0) {
    await db.mediaAsset.updateMany({
      data: {
        owner_id: submission.id,
        owner_type: "SUBMISSION"
      },
      where: {
        OR: [
          ...(attachmentIds.length > 0
            ? [
                {
                  id: {
                    in: attachmentIds
                  }
                }
              ]
            : []),
          ...(uploadSessionIds.length > 0
            ? [
                {
                  upload_session_id: {
                    in: uploadSessionIds
                  }
                }
              ]
            : [])
        ]
      }
    });
  }

  await enqueueSubmissionNotificationsBestEffort(
    {
      kind: submission.kind,
      organizationId: organization.id,
      rating: submission.rating,
      submissionId: submission.id
    },
    db
  );

  return submission;
};
