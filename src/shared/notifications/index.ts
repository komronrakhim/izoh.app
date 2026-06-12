import { z } from "zod";

export const NOTIFICATION_MODES = ["ALL", "IMPORTANT_ONLY", "OFF"] as const;
export const NOTIFICATION_TARGET_TYPES = ["OWNER_DM", "TELEGRAM_GROUP"] as const;
export const NOTIFICATION_TARGET_STATUSES = ["ACTIVE", "DISCONNECTED"] as const;

export type OrganizationNotificationMode = (typeof NOTIFICATION_MODES)[number];
export type OrganizationNotificationTargetType = (typeof NOTIFICATION_TARGET_TYPES)[number];
export type OrganizationNotificationTargetStatus = (typeof NOTIFICATION_TARGET_STATUSES)[number];

export type OrganizationNotificationTarget = {
  complaintEnabled: boolean;
  connectedAt: null | string;
  disconnectedAt: null | string;
  id: string;
  lastError: null | string;
  mode?: OrganizationNotificationMode;
  recipientUserId: null | string;
  reviewEnabled: boolean;
  status: OrganizationNotificationTargetStatus;
  suggestionEnabled: boolean;
  telegramChatTitle: null | string;
  type: OrganizationNotificationTargetType;
};

export type OrganizationNotificationGroupConnectLink = {
  expiresAt: string;
  telegramUrl: string;
};

export type OrganizationNotificationsPayload = {
  groupConnectLink: null | OrganizationNotificationGroupConnectLink;
  organizationId: string;
  targets: OrganizationNotificationTarget[];
};

export type NotificationSubmissionInput = {
  kind: "COMPLAINT" | "REVIEW" | "SUGGESTION";
  rating?: null | number;
};

export const notificationTargetPatchSchema = z
  .object({
    complaintEnabled: z.boolean().optional(),
    mode: z.enum(NOTIFICATION_MODES).optional(),
    reviewEnabled: z.boolean().optional(),
    suggestionEnabled: z.boolean().optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one notification target field is required."
  });

export type NotificationTargetPatch = z.infer<typeof notificationTargetPatchSchema>;

export const parseNotificationTargetPatch = (patch: unknown): NotificationTargetPatch =>
  notificationTargetPatchSchema.parse(patch);

export const getDefaultOwnerNotificationTarget = ({
  organizationId,
  recipientUserId = null
}: {
  organizationId: string;
  recipientUserId?: null | string;
}): OrganizationNotificationTarget => ({
  complaintEnabled: true,
  connectedAt: null,
  disconnectedAt: null,
  id: `${organizationId}:owner`,
  lastError: null,
  mode: "ALL",
  recipientUserId,
  reviewEnabled: true,
  status: "ACTIVE",
  suggestionEnabled: true,
  telegramChatTitle: null,
  type: "OWNER_DM"
});

export const isImportantSubmission = (
  { kind, rating }: NotificationSubmissionInput,
  lowRatingThreshold = 3
) => {
  if (kind === "COMPLAINT") {
    return true;
  }

  if (kind === "REVIEW") {
    return typeof rating === "number" && rating <= lowRatingThreshold;
  }

  return false;
};

const isKindEnabledForTarget = (
  target: Pick<
    OrganizationNotificationTarget,
    "complaintEnabled" | "reviewEnabled" | "suggestionEnabled"
  >,
  kind: NotificationSubmissionInput["kind"]
) => {
  if (kind === "REVIEW") return target.reviewEnabled;
  if (kind === "COMPLAINT") return target.complaintEnabled;

  return target.suggestionEnabled;
};

export const shouldSendNotificationToTarget = (
  target: Pick<
    OrganizationNotificationTarget,
    "complaintEnabled" | "mode" | "reviewEnabled" | "status" | "suggestionEnabled" | "type"
  >,
  submission: NotificationSubmissionInput,
  lowRatingThreshold = 3
) => {
  if (target.status !== "ACTIVE") {
    return false;
  }

  if (target.type === "OWNER_DM" && target.mode === "OFF") {
    return false;
  }

  if (!isKindEnabledForTarget(target, submission.kind)) {
    return false;
  }

  if (target.type === "OWNER_DM" && target.mode === "IMPORTANT_ONLY") {
    return isImportantSubmission(submission, lowRatingThreshold);
  }

  return true;
};
