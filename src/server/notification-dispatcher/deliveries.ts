import type { PrismaClient } from "../../../prisma/generated/prisma/client";

import {
  sendTelegramNotificationDelivery,
  TelegramPermanentDeliveryError
} from "~/server/telegram";
import { markTelegramGroupDisconnectedByChatId } from "~/server/domain/notification-settings";

type DispatcherDb = PrismaClient;

type ClaimOptions = {
  batchSize: number;
  lockMs: number;
};

type ProcessOptions = {
  maxAttempts: number;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown Telegram delivery error.";

export const isPermanentTelegramDeliveryError = (error: unknown) => {
  if (error instanceof TelegramPermanentDeliveryError) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();

  return [
    "bot was blocked",
    "bot was kicked",
    "chat not found",
    "forbidden",
    "not enough rights",
    "user is deactivated"
  ].some((needle) => message.includes(needle));
};

const getRetryDelayMs = (attemptCount: number) =>
  Math.min(15 * 60 * 1000, 30 * 1000 * 2 ** Math.max(0, attemptCount - 1));

export const claimPendingTelegramNotificationDeliveries = async (
  db: DispatcherDb,
  { batchSize, lockMs }: ClaimOptions
) => {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + lockMs);
  const candidates = await db.telegramNotificationDelivery.findMany({
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
    const result = await db.telegramNotificationDelivery.updateMany({
      data: {
        attempt_count: {
          increment: 1
        },
        locked_until: lockUntil
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

const markDeliveryFailed = async (
  db: DispatcherDb,
  {
    deliveryId,
    error,
    permanent
  }: {
    deliveryId: string;
    error: unknown;
    permanent: boolean;
  }
) => {
  const message = getErrorMessage(error);
  const delivery = await db.telegramNotificationDelivery.findUnique({
    include: {
      target: true
    },
    where: {
      id: deliveryId
    }
  });

  await db.telegramNotificationDelivery.update({
    data: {
      error: message,
      failed_at: new Date(),
      locked_until: null,
      status: "FAILED"
    },
    where: {
      id: deliveryId
    }
  });

  if (permanent && delivery?.target.type === "TELEGRAM_GROUP" && delivery.target.telegram_chat_id) {
    await markTelegramGroupDisconnectedByChatId(
      {
        reason: message,
        telegramChatId: delivery.target.telegram_chat_id
      },
      db
    );
  }
};

const scheduleDeliveryRetry = async (
  db: DispatcherDb,
  {
    deliveryId,
    error
  }: {
    deliveryId: string;
    error: unknown;
  }
) => {
  const delivery = await db.telegramNotificationDelivery.findUnique({
    select: {
      attempt_count: true
    },
    where: {
      id: deliveryId
    }
  });
  const attemptCount = delivery?.attempt_count ?? 1;

  await db.telegramNotificationDelivery.update({
    data: {
      error: getErrorMessage(error),
      locked_until: null,
      next_attempt_at: new Date(Date.now() + getRetryDelayMs(attemptCount)),
      status: "PENDING"
    },
    where: {
      id: deliveryId
    }
  });
};

export const processTelegramNotificationDelivery = async (
  db: DispatcherDb,
  deliveryId: string,
  { maxAttempts }: ProcessOptions
) => {
  try {
    await sendTelegramNotificationDelivery(deliveryId, db);
  } catch (error) {
    const delivery = await db.telegramNotificationDelivery.findUnique({
      select: {
        attempt_count: true
      },
      where: {
        id: deliveryId
      }
    });
    const permanent = isPermanentTelegramDeliveryError(error);

    if (permanent || (delivery?.attempt_count ?? 1) >= maxAttempts) {
      await markDeliveryFailed(db, {
        deliveryId,
        error,
        permanent
      });
      return;
    }

    await scheduleDeliveryRetry(db, {
      deliveryId,
      error
    });
  }
};

export const processPendingTelegramNotificationDeliveriesOnce = async (
  db: DispatcherDb,
  { batchSize, lockMs, maxAttempts }: ClaimOptions & ProcessOptions
) => {
  const claimedIds = await claimPendingTelegramNotificationDeliveries(db, {
    batchSize,
    lockMs
  });

  await Promise.all(
    claimedIds.map((deliveryId) =>
      processTelegramNotificationDelivery(db, deliveryId, {
        maxAttempts
      })
    )
  );

  return claimedIds.length;
};
