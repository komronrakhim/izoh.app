import { z } from "zod";

import { SUBMISSION_PHOTO_LIMIT, SUBMISSION_PHOTO_MAX_BYTES } from "~/shared/media";
import { COMPLAINT_CATEGORY_IDS, SUGGESTION_TOPIC_IDS } from "~/shared/module-settings";
import { APP_LOCALES, type AppLocale } from "~/shared/i18n";

export { SUBMISSION_PHOTO_LIMIT, SUBMISSION_PHOTO_MAX_BYTES } from "~/shared/media";
export const SUBMISSION_BODY_MAX_LENGTH = 2000;
export const SUBMISSION_CONTACT_MAX_LENGTH = 80;
export const SUBMISSION_DISPLAY_NAME_MAX_LENGTH = 120;

export const submissionKindSchema = z.enum(["REVIEW", "COMPLAINT", "SUGGESTION"]);
export const prismaLocaleSchema = z.enum(APP_LOCALES);
export const complaintCategoryIdSchema = z.enum(COMPLAINT_CATEGORY_IDS);
export const suggestionTopicIdSchema = z.enum(SUGGESTION_TOPIC_IDS);
export const staffTargetTypeSchema = z.enum(["none", "team", "employee", "unknown"]);
export const staffTargetSnapshotSchema = z
  .object({
    avatarUrl: z.string().max(500).nullable().optional(),
    displayName: z.string().min(1).max(120),
    id: z.string().min(1).max(120),
    roleTitle: z.string().max(120).optional()
  })
  .strict();

export const submissionMetadataSchema = z
  .object({
    complaintCategoryIds: z.array(complaintCategoryIdSchema).max(12).optional(),
    staffTargetSnapshot: staffTargetSnapshotSchema.optional(),
    staffTargetType: staffTargetTypeSchema.optional(),
    suggestionTopicIds: z.array(suggestionTopicIdSchema).max(12).optional(),
    wizardChoiceId: z.string().max(40).nullable().optional()
  })
  .strict();

export const createSubmissionRequestSchema = z
  .object({
    attachmentMediaAssetIds: z.array(z.string()).max(SUBMISSION_PHOTO_LIMIT).optional(),
    attachmentOwnerId: z.string().max(120).optional(),
    bodyText: z.string().max(SUBMISSION_BODY_MAX_LENGTH).optional(),
    customerAllowsReply: z.boolean().optional(),
    customerContactPhone: z.string().max(SUBMISSION_CONTACT_MAX_LENGTH).optional(),
    customerDisplayName: z.string().max(SUBMISSION_DISPLAY_NAME_MAX_LENGTH).optional(),
    kind: submissionKindSchema,
    locale: prismaLocaleSchema.optional(),
    metadata: submissionMetadataSchema.optional(),
    guestEntryScanId: z.string().trim().min(1).max(120).optional(),
    organizationId: z.string().min(1),
    rating: z.number().int().min(1).max(5).optional(),
    startParam: z.string().optional(),
    targetStaffMemberId: z.string().optional()
  })
  .strict();

export type SubmissionKindInput = z.infer<typeof submissionKindSchema>;
export type SubmissionMetadata = z.infer<typeof submissionMetadataSchema>;
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>;

export type AdminSubmissionAttachment = {
  id: string;
  publicUrl: string;
  sortOrder: number;
};

export type AdminSubmissionItem = {
  attachments: AdminSubmissionAttachment[];
  bodyText: string;
  createdAt: string;
  customerAllowsReply: boolean;
  customerContactPhone: null | string;
  customerDisplayName: null | string;
  id: string;
  kind: SubmissionKindInput;
  locale: AppLocale;
  metadata: SubmissionMetadata;
  qrContext: null | string;
  rating: null | number;
  targetStaffMember: null | {
    displayName: string;
    id: string;
    roleTitle: string;
  };
};

export type AdminSubmissionCounts = Record<"ALL" | SubmissionKindInput, number>;

export type AdminSubmissionsPayload = {
  counts: AdminSubmissionCounts;
  items: AdminSubmissionItem[];
  nextCursor: null | string;
  organizationId: string;
  total: number;
};

export type CreateSubmissionResponsePayload = {
  submission: AdminSubmissionItem;
};

export const parseSubmissionMetadata = (metadata: unknown): SubmissionMetadata =>
  submissionMetadataSchema.parse(metadata ?? {});

export const safeParseSubmissionMetadata = (metadata: unknown): SubmissionMetadata => {
  const parsed = submissionMetadataSchema.safeParse(metadata ?? {});

  return parsed.success ? parsed.data : {};
};
