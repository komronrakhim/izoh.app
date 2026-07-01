import type { Prisma, SubmissionKind } from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { ensureOwnerNotificationTarget } from "~/server/domain/notification-settings";
import { parseModuleSettingsConfig } from "~/shared/module-settings";
import { shouldSendNotificationToTarget } from "~/shared/notifications";

type EnqueueSubmissionNotificationsInput = {
  kind: SubmissionKind;
  organizationId: string;
  rating?: null | number;
  submissionId: string;
};

const getReviewLowRatingThreshold = (
  moduleSettings: Array<{ config: unknown; module: string }>
) => {
  const reviewSetting = moduleSettings.find((setting) => setting.module === "REVIEW");
  const reviewConfig = parseModuleSettingsConfig({
    config: reviewSetting?.config,
    itemId: "review"
  });

  return reviewConfig.lowRatingThreshold;
};

export const enqueueSubmissionNotifications = async (
  { kind, organizationId, rating, submissionId }: EnqueueSubmissionNotificationsInput,
  db: DomainDb = getDomainDb()
) => {
  const organization = await db.organization.findUnique({
    include: {
      module_settings: true,
      notification_targets: true
    },
    where: {
      id: organizationId
    }
  });

  if (!organization || organization.status !== "ACTIVE") {
    return 0;
  }

  const ownerTarget =
    organization.notification_targets.find((target) => target.type === "OWNER_DM") ??
    (await ensureOwnerNotificationTarget(
      {
        organizationId: organization.id,
        ownerUserId: organization.owner_user_id
      },
      db
    ));
  const targets = [
    ownerTarget,
    ...organization.notification_targets.filter((target) => target.id !== ownerTarget.id)
  ];
  const lowRatingThreshold = getReviewLowRatingThreshold(organization.module_settings);
  const deliveryData = targets
    .filter((target) =>
      shouldSendNotificationToTarget(
        {
          complaintEnabled: target.complaint_enabled,
          mode: target.mode,
          reviewEnabled: target.review_enabled,
          status: target.status,
          suggestionEnabled: target.suggestion_enabled,
          type: target.type
        },
        {
          kind,
          rating
        },
        lowRatingThreshold
      )
    )
    .map(
      (target): Prisma.TelegramNotificationDeliveryCreateManyInput => ({
        recipient_user_id: target.recipient_user_id,
        submission_id: submissionId,
        target_id: target.id,
        target_type: target.type,
        telegram_chat_id: target.telegram_chat_id
      })
    );

  if (deliveryData.length === 0) {
    return 0;
  }

  const result = await db.telegramNotificationDelivery.createMany({
    data: deliveryData,
    skipDuplicates: true
  });

  return result.count;
};
