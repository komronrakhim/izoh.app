import { GrammyError, InputFile } from "grammy";
import type { Prisma, PrismaClient } from "../../../prisma/generated/prisma/client";

import { getMediaPublicUrl } from "~/server/media/public-url";
import { renderOrganizationQrPdf, type OrganizationQrPdfTemplate } from "~/server/pdf";
import { getTelegramBot, getTelegramMiniAppUrl } from "~/server/telegram";
import { fromPrismaLocale } from "~/shared/i18n";

type QrPdfDispatcherDb = PrismaClient;

type ClaimOptions = {
  batchSize: number;
  lockMs: number;
};

type ProcessOptions = {
  maxAttempts: number;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown QR PDF delivery error.";

const getRetryDelayMs = (attemptCount: number) =>
  Math.min(15 * 60 * 1000, 30 * 1000 * 2 ** Math.max(0, attemptCount - 1));

const getTelegramRetryAfterMs = (error: unknown) => {
  const retryAfter = (error as { parameters?: { retry_after?: unknown } })?.parameters
    ?.retry_after;

  return typeof retryAfter === "number" && Number.isFinite(retryAfter) && retryAfter > 0
    ? retryAfter * 1000
    : null;
};

const isPermanentQrPdfDeliveryError = (error: unknown) => {
  if (!(error instanceof GrammyError)) {
    return false;
  }

  return error.error_code === 400 || error.error_code === 403;
};

const readQrTemplate = (value: Prisma.JsonValue | null): OrganizationQrPdfTemplate => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as OrganizationQrPdfTemplate;
};

export const claimPendingQrPdfDeliveries = async (
  db: QrPdfDispatcherDb,
  { batchSize, lockMs }: ClaimOptions
) => {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + lockMs);
  const candidates = await db.qrPdfDelivery.findMany({
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
      status: "PROCESSING"
    }
  });
  const claimedIds: string[] = [];

  for (const candidate of candidates) {
    const result = await db.qrPdfDelivery.updateMany({
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
        status: "PROCESSING"
      }
    });

    if (result.count === 1) {
      claimedIds.push(candidate.id);
    }
  }

  return claimedIds;
};

const markDeliverySent = async (
  db: QrPdfDispatcherDb,
  {
    deliveryId,
    telegramMessageId
  }: {
    deliveryId: string;
    telegramMessageId?: number;
  }
) => {
  await db.qrPdfDelivery.update({
    data: {
      error: null,
      failed_at: null,
      locked_until: null,
      sent_at: new Date(),
      status: "SENT",
      telegram_message_id: telegramMessageId
    },
    where: {
      id: deliveryId
    }
  });
};

const markDeliveryFailed = async (
  db: QrPdfDispatcherDb,
  {
    deliveryId,
    error
  }: {
    deliveryId: string;
    error: unknown;
  }
) => {
  await db.qrPdfDelivery.update({
    data: {
      error: getErrorMessage(error),
      failed_at: new Date(),
      locked_until: null,
      status: "FAILED"
    },
    where: {
      id: deliveryId
    }
  });
};

const scheduleDeliveryRetry = async (
  db: QrPdfDispatcherDb,
  {
    deliveryId,
    error
  }: {
    deliveryId: string;
    error: unknown;
  }
) => {
  const delivery = await db.qrPdfDelivery.findUnique({
    select: {
      attempt_count: true
    },
    where: {
      id: deliveryId
    }
  });
  const attemptCount = delivery?.attempt_count ?? 1;
  const retryAfterMs = getTelegramRetryAfterMs(error);
  const retryDelayMs = retryAfterMs
    ? Math.max(retryAfterMs, getRetryDelayMs(attemptCount))
    : getRetryDelayMs(attemptCount);

  await db.qrPdfDelivery.update({
    data: {
      error: getErrorMessage(error),
      locked_until: null,
      next_attempt_at: new Date(Date.now() + retryDelayMs),
      status: "PROCESSING"
    },
    where: {
      id: deliveryId
    }
  });
};

export const processQrPdfDelivery = async (
  db: QrPdfDispatcherDb,
  deliveryId: string,
  { maxAttempts }: ProcessOptions
) => {
  try {
    const delivery = await db.qrPdfDelivery.findUnique({
      include: {
        organization: true,
        user: true
      },
      where: {
        id: deliveryId
      }
    });

    if (!delivery) {
      return;
    }

    if (!delivery.start_param) {
      throw new Error("QR PDF delivery start param is missing.");
    }

    const logoAsset = delivery.organization.logo_media_asset_id
      ? await db.mediaAsset.findFirst({
          select: {
            bucket: true,
            public_url: true,
            storage_key: true
          },
          where: {
            id: delivery.organization.logo_media_asset_id,
            kind: "ORGANIZATION_LOGO",
            owner_id: delivery.organization.id,
            owner_type: "ORGANIZATION",
            status: "READY"
          }
        })
      : null;
    const pdf = await renderOrganizationQrPdf({
      locale: fromPrismaLocale(delivery.organization.locale),
      organizationLogo: logoAsset
        ? {
            bucket: logoAsset.bucket,
            publicUrl: getMediaPublicUrl(logoAsset),
            storageKey: logoAsset.storage_key
          }
        : null,
      organizationName: delivery.organization.name,
      template: readQrTemplate(delivery.template),
      url: getTelegramMiniAppUrl(delivery.start_param)
    });
    const message = await getTelegramBot().api.sendDocument(
      delivery.user.telegram_id.toString(),
      new InputFile(pdf, delivery.file_name)
    );

    await markDeliverySent(db, {
      deliveryId,
      telegramMessageId: message.message_id
    });
  } catch (error) {
    const delivery = await db.qrPdfDelivery.findUnique({
      select: {
        attempt_count: true
      },
      where: {
        id: deliveryId
      }
    });

    if (!delivery) {
      return;
    }

    if (isPermanentQrPdfDeliveryError(error) || delivery.attempt_count >= maxAttempts) {
      await markDeliveryFailed(db, {
        deliveryId,
        error
      });
      return;
    }

    await scheduleDeliveryRetry(db, {
      deliveryId,
      error
    });
  }
};

export const processPendingQrPdfDeliveriesOnce = async (
  db: QrPdfDispatcherDb,
  { batchSize, lockMs, maxAttempts }: ClaimOptions & ProcessOptions
) => {
  const claimedIds = await claimPendingQrPdfDeliveries(db, {
    batchSize,
    lockMs
  });

  await Promise.all(
    claimedIds.map((deliveryId) =>
      processQrPdfDelivery(db, deliveryId, {
        maxAttempts
      })
    )
  );

  return claimedIds.length;
};
