import { z } from "zod";

export const NOTIFICATION_MODES = ["ALL", "IMPORTANT_ONLY", "OFF"] as const;

export type OrganizationNotificationMode = (typeof NOTIFICATION_MODES)[number];

export type OrganizationNotificationSettings = {
  mode: OrganizationNotificationMode;
  organizationId: string;
  ownerDmEnabled: boolean;
  telegramGroupChatId: null | string;
  telegramGroupEnabled: boolean;
  telegramGroupTitle: null | string;
};

export type NotificationSubmissionInput = {
  kind: "COMPLAINT" | "REVIEW" | "SUGGESTION";
  rating?: null | number;
};

const optionalGroupChatIdSchema = z
  .union([z.string().trim().regex(/^-?\d+$/).max(80), z.null()])
  .optional();

const optionalGroupTitleSchema = z
  .union([z.string().trim().min(1).max(120), z.null()])
  .optional();

export const notificationSettingsPatchSchema = z.object({
  mode: z.enum(NOTIFICATION_MODES).optional(),
  ownerDmEnabled: z.boolean().optional(),
  telegramGroupChatId: optionalGroupChatIdSchema,
  telegramGroupEnabled: z.boolean().optional(),
  telegramGroupTitle: optionalGroupTitleSchema
});

export type NotificationSettingsPatch = z.infer<typeof notificationSettingsPatchSchema>;

export const getDefaultNotificationSettings = (
  organizationId: string
): OrganizationNotificationSettings => ({
  mode: "ALL",
  organizationId,
  ownerDmEnabled: true,
  telegramGroupChatId: null,
  telegramGroupEnabled: false,
  telegramGroupTitle: null
});

export const parseNotificationSettingsPatch = (patch: unknown): NotificationSettingsPatch =>
  notificationSettingsPatchSchema.parse(patch);

export const isImportantSubmission = ({ kind, rating }: NotificationSubmissionInput) => {
  if (kind === "COMPLAINT") {
    return true;
  }

  if (kind === "REVIEW") {
    return typeof rating === "number" && rating <= 3;
  }

  return false;
};

export const shouldSendNotification = (
  settings: Pick<OrganizationNotificationSettings, "mode">,
  submission: NotificationSubmissionInput
) => {
  if (settings.mode === "OFF") {
    return false;
  }

  if (settings.mode === "IMPORTANT_ONLY") {
    return isImportantSubmission(submission);
  }

  return true;
};
