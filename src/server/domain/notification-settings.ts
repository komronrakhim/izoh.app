import { randomInt } from "node:crypto";

import type {
  AppLocale,
  OrganizationNotificationGroupConnectToken,
  OrganizationNotificationTarget
} from "../../../prisma/generated/prisma/client";

import { getOptionalEnv } from "~/server/config/env";
import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import {
  getDefaultOwnerNotificationTarget,
  parseNotificationTargetPatch,
  type NotificationTargetPatch,
  type OrganizationNotificationsPayload,
  type OrganizationNotificationTarget as OrganizationNotificationTargetPayload
} from "~/shared/notifications";

const groupConnectTokenAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const groupConnectTokenTtlMs = 15 * 60 * 1000;

export type TelegramGroupConnectErrorReason = "INVALID_OR_EXPIRED" | "OWNER_MISMATCH";

export class TelegramGroupConnectError extends Error {
  ownerLocale?: AppLocale;
  reason: TelegramGroupConnectErrorReason;

  constructor(reason: TelegramGroupConnectErrorReason, ownerLocale?: AppLocale) {
    super(reason);
    this.name = "TelegramGroupConnectError";
    this.ownerLocale = ownerLocale;
    this.reason = reason;
  }
}

const getTelegramGroupConnectUrl = (token: string) => {
  const botUsername = (getOptionalEnv("TELEGRAM_BOT_USERNAME") ?? "izohappbot").replace(/^@+/, "");

  return `https://t.me/${botUsername}?startgroup=${encodeURIComponent(token)}`;
};

const toNotificationTargetPayload = (target: OrganizationNotificationTarget) => {
  const payload = {
    complaintEnabled: target.complaint_enabled,
    connectedAt: target.connected_at?.toISOString() ?? null,
    disconnectedAt: target.disconnected_at?.toISOString() ?? null,
    id: target.id,
    lastError: target.last_error,
    recipientUserId: target.recipient_user_id,
    reviewEnabled: target.review_enabled,
    status: target.status,
    suggestionEnabled: target.suggestion_enabled,
    telegramChatTitle: target.telegram_chat_title,
    type: target.type
  };

  return target.type === "OWNER_DM"
    ? {
        ...payload,
        mode: target.mode
      }
    : payload;
};

const toGroupConnectLinkPayload = (
  token: null | Pick<OrganizationNotificationGroupConnectToken, "token" | "expires_at">
) =>
  token
    ? {
        expiresAt: token.expires_at.toISOString(),
        telegramUrl: getTelegramGroupConnectUrl(token.token)
      }
    : null;

const toNotificationsPayload = ({
  activeGroupConnectToken,
  organizationId,
  targets
}: {
  activeGroupConnectToken?: null | Pick<
    OrganizationNotificationGroupConnectToken,
    "expires_at" | "token"
  >;
  organizationId: string;
  targets: OrganizationNotificationTarget[];
}): OrganizationNotificationsPayload => ({
  groupConnectLink: toGroupConnectLinkPayload(activeGroupConnectToken ?? null),
  organizationId,
  targets: targets.map(toNotificationTargetPayload)
});

const generateGroupConnectToken = () =>
  Array.from(
    {
      length: 6
    },
    () => groupConnectTokenAlphabet[randomInt(groupConnectTokenAlphabet.length)]
  ).join("");

const toDbPatch = (patch: NotificationTargetPatch) => ({
  ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
  ...(patch.reviewEnabled !== undefined ? { review_enabled: patch.reviewEnabled } : {}),
  ...(patch.complaintEnabled !== undefined ? { complaint_enabled: patch.complaintEnabled } : {}),
  ...(patch.suggestionEnabled !== undefined ? { suggestion_enabled: patch.suggestionEnabled } : {})
});

const getLatestActiveGroupConnectToken = async (organizationId: string, db: DomainDb) =>
  db.organizationNotificationGroupConnectToken.findFirst({
    orderBy: {
      created_at: "desc"
    },
    select: {
      token: true,
      expires_at: true
    },
    where: {
      expires_at: {
        gt: new Date()
      },
      organization_id: organizationId,
      used_at: null
    }
  });

const assertActiveOrganization = async (organizationId: string, db: DomainDb) => {
  const organization = await db.organization.findUnique({
    include: {
      notification_targets: {
        orderBy: {
          created_at: "asc"
        }
      }
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

export const ensureOwnerNotificationTarget = async (
  {
    organizationId,
    ownerUserId
  }: {
    organizationId: string;
    ownerUserId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const existing = await db.organizationNotificationTarget.findFirst({
    where: {
      organization_id: organizationId,
      recipient_user_id: ownerUserId,
      type: "OWNER_DM"
    }
  });

  if (existing) {
    return existing;
  }

  return db.organizationNotificationTarget.create({
    data: {
      organization_id: organizationId,
      recipient_user_id: ownerUserId,
      type: "OWNER_DM"
    }
  });
};

export const getOrganizationNotificationSettings = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
) => {
  const organization = await assertActiveOrganization(organizationId, db);

  if (!organization.notification_targets.some((target) => target.type === "OWNER_DM")) {
    const ownerTarget = await ensureOwnerNotificationTarget(
      {
        organizationId: organization.id,
        ownerUserId: organization.owner_user_id
      },
      db
    );
    const activeGroupConnectToken = await getLatestActiveGroupConnectToken(organization.id, db);

    return toNotificationsPayload({
      activeGroupConnectToken,
      organizationId: organization.id,
      targets: [...organization.notification_targets, ownerTarget]
    });
  }

  const activeGroupConnectToken = await getLatestActiveGroupConnectToken(organization.id, db);

  return toNotificationsPayload({
    activeGroupConnectToken,
    organizationId: organization.id,
    targets: organization.notification_targets
  });
};

export const updateOrganizationNotificationTarget = async (
  {
    organizationId,
    patch,
    targetId
  }: {
    organizationId: string;
    patch: unknown;
    targetId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);

  const target = await db.organizationNotificationTarget.findFirst({
    where: {
      id: targetId,
      organization_id: organizationId
    }
  });

  if (!target) {
    throw new Error("Notification target is not available.");
  }

  const parsedPatch = parseNotificationTargetPatch(patch);
  const dbPatch =
    target.type === "TELEGRAM_GROUP"
      ? toDbPatch({
          complaintEnabled: parsedPatch.complaintEnabled,
          reviewEnabled: parsedPatch.reviewEnabled,
          suggestionEnabled: parsedPatch.suggestionEnabled
        })
      : toDbPatch(parsedPatch);

  await db.organizationNotificationTarget.update({
    data: dbPatch,
    where: {
      id: target.id
    }
  });

  return getOrganizationNotificationSettings(organizationId, db);
};

export const createOrganizationNotificationGroupConnectLink = async (
  {
    createdByUserId,
    organizationId
  }: {
    createdByUserId: string;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const organization = await assertActiveOrganization(organizationId, db);

  if (organization.owner_user_id !== createdByUserId) {
    throw new Error("Only organization owner can connect a group.");
  }

  let token = generateGroupConnectToken();
  let attempts = 0;

  while (attempts < 5) {
    const existing = await db.organizationNotificationGroupConnectToken.findUnique({
      where: {
        token
      }
    });

    if (!existing) {
      break;
    }

    token = generateGroupConnectToken();
    attempts += 1;
  }

  await db.organizationNotificationGroupConnectToken.create({
    data: {
      token,
      created_by_user_id: createdByUserId,
      expires_at: new Date(Date.now() + groupConnectTokenTtlMs),
      organization_id: organization.id
    }
  });

  return getOrganizationNotificationSettings(organization.id, db);
};

export const disconnectOrganizationNotificationGroup = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
) => {
  const organization = await assertActiveOrganization(organizationId, db);

  await db.organizationNotificationTarget.updateMany({
    data: {
      disconnected_at: new Date(),
      status: "DISCONNECTED"
    },
    where: {
      organization_id: organization.id,
      type: "TELEGRAM_GROUP"
    }
  });

  return getOrganizationNotificationSettings(organization.id, db);
};

export const connectTelegramGroupByToken = async (
  {
    token,
    telegramChatId,
    telegramChatTitle,
    telegramUserId
  }: {
    token: string;
    telegramChatId: bigint;
    telegramChatTitle?: null | string;
    telegramUserId?: bigint;
  },
  db: DomainDb = getDomainDb()
) => {
  const normalizedToken = token.trim().toUpperCase();
  const connectToken = await db.organizationNotificationGroupConnectToken.findUnique({
    include: {
      organization: {
        include: {
          owner: true
        }
      }
    },
    where: {
      token: normalizedToken
    }
  });

  if (!connectToken || connectToken.used_at || connectToken.expires_at <= new Date()) {
    throw new TelegramGroupConnectError("INVALID_OR_EXPIRED");
  }

  if (!telegramUserId || connectToken.organization.owner.telegram_id !== telegramUserId) {
    throw new TelegramGroupConnectError("OWNER_MISMATCH", connectToken.organization.owner.locale);
  }

  const existingGroupTarget = await db.organizationNotificationTarget.findFirst({
    where: {
      organization_id: connectToken.organization_id,
      type: "TELEGRAM_GROUP"
    }
  });

  const targetData = {
    connected_at: new Date(),
    disconnected_at: null,
    last_error: null,
    status: "ACTIVE" as const,
    telegram_chat_id: telegramChatId,
    telegram_chat_title: telegramChatTitle?.trim() || null
  };

  const target = existingGroupTarget
    ? await db.organizationNotificationTarget.update({
        data: targetData,
        where: {
          id: existingGroupTarget.id
        }
      })
    : await db.organizationNotificationTarget.create({
        data: {
          ...targetData,
          organization_id: connectToken.organization_id,
          type: "TELEGRAM_GROUP"
        }
      });

  await db.organizationNotificationGroupConnectToken.update({
    data: {
      used_at: new Date()
    },
    where: {
      id: connectToken.id
    }
  });

  return {
    organizationName: connectToken.organization.name,
    ownerLocale: connectToken.organization.owner.locale,
    target
  };
};

export const markTelegramGroupDisconnectedByChatId = async (
  {
    reason,
    telegramChatId
  }: {
    reason?: string;
    telegramChatId: bigint;
  },
  db: DomainDb = getDomainDb()
) =>
  db.organizationNotificationTarget.updateMany({
    data: {
      disconnected_at: new Date(),
      last_error: reason ?? "Bot was removed from the group.",
      status: "DISCONNECTED"
    },
    where: {
      status: "ACTIVE",
      telegram_chat_id: telegramChatId,
      type: "TELEGRAM_GROUP"
    }
  });

export const getFallbackOwnerNotificationTarget = getDefaultOwnerNotificationTarget;
