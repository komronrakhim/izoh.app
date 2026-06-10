import type { OrganizationNotificationSetting } from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import {
  getDefaultNotificationSettings,
  parseNotificationSettingsPatch,
  type NotificationSettingsPatch,
  type OrganizationNotificationSettings
} from "~/shared/notifications";

const toNotificationSettingsPayload = ({
  organizationId,
  setting
}: {
  organizationId: string;
  setting?: null | OrganizationNotificationSetting;
}): OrganizationNotificationSettings => ({
  ...getDefaultNotificationSettings(organizationId),
  ...(setting
    ? {
        mode: setting.mode,
        ownerDmEnabled: setting.owner_dm_enabled,
        telegramGroupChatId: setting.telegram_group_chat_id?.toString() ?? null,
        telegramGroupEnabled: setting.telegram_group_enabled,
        telegramGroupTitle: setting.telegram_group_title
      }
    : {})
});

const assertActiveOrganization = async (organizationId: string, db: DomainDb) => {
  const organization = await db.organization.findUnique({
    include: {
      notification_setting: true
    },
    where: {
      id: organizationId
    }
  });

  if (!organization || organization.status !== "ACTIVE") {
    throw new Error("Organization is not available.");
  }

  return organization;
};

const toDbPatch = (patch: NotificationSettingsPatch) => ({
  ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
  ...(patch.ownerDmEnabled !== undefined ? { owner_dm_enabled: patch.ownerDmEnabled } : {}),
  ...(patch.telegramGroupEnabled !== undefined
    ? { telegram_group_enabled: patch.telegramGroupEnabled }
    : {}),
  ...(patch.telegramGroupChatId !== undefined
    ? {
        telegram_group_chat_id:
          patch.telegramGroupChatId === null ? null : BigInt(patch.telegramGroupChatId)
      }
    : {}),
  ...(patch.telegramGroupTitle !== undefined
    ? {
        telegram_group_title: patch.telegramGroupTitle
      }
    : {})
});

export const getOrganizationNotificationSettings = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
) => {
  const organization = await assertActiveOrganization(organizationId, db);

  return toNotificationSettingsPayload({
    organizationId: organization.id,
    setting: organization.notification_setting
  });
};

export const updateOrganizationNotificationSettings = async (
  {
    organizationId,
    patch
  }: {
    organizationId: string;
    patch: unknown;
  },
  db: DomainDb = getDomainDb()
) => {
  const parsedPatch = parseNotificationSettingsPatch(patch);
  const organization = await assertActiveOrganization(organizationId, db);
  const current = toNotificationSettingsPayload({
    organizationId: organization.id,
    setting: organization.notification_setting
  });
  const next = {
    ...current,
    ...parsedPatch
  };

  if (next.telegramGroupEnabled && !next.telegramGroupChatId) {
    throw new Error("Telegram group is not connected.");
  }

  const setting = await db.organizationNotificationSetting.upsert({
    create: {
      organization_id: organization.id,
      ...toDbPatch(parsedPatch)
    },
    update: toDbPatch(parsedPatch),
    where: {
      organization_id: organization.id
    }
  });

  return toNotificationSettingsPayload({
    organizationId: organization.id,
    setting
  });
};
