import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { InputFile } from "grammy";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { getPrisma } from "~/server/db";
import { getOrganizationAnalytics } from "~/server/domain/analytics";
import {
  getOrganizationGuestMenu,
  updateOrganizationGuestMenuItem
} from "~/server/domain/guest-menu";
import {
  getOrganizationModuleSettings,
  updateOrganizationModuleSettings
} from "~/server/domain/module-settings";
import {
  createAdminOrganization,
  enqueueAdminOrganizationDeletion,
  getAdminOrganizations,
  updateAdminOrganizationLogo
} from "~/server/domain/organizations";
import {
  connectTelegramGroupByToken,
  createOrganizationNotificationGroupConnectLink,
  disconnectOrganizationNotificationGroup,
  getOrganizationNotificationSettings,
  markTelegramGroupDisconnectedByChatId,
  TelegramGroupConnectError,
  updateOrganizationNotificationTarget
} from "~/server/domain/notification-settings";
import { getGuestEntryConfig } from "~/server/domain/guest-entry-config";
import {
  getOrCreateOrganizationGuestContext,
  getOrganizationGuestContextByCode
} from "~/server/domain/guest-contexts";
import {
  createOrganizationStaffMember,
  deleteOrganizationStaffMember,
  getOrganizationStaffMember,
  getOrganizationStaffMembers,
  updateOrganizationStaffMember
} from "~/server/domain/staff-members";
import {
  createSubmission,
  getOrganizationSubmissions,
  getSubmissionAdminItem
} from "~/server/domain/submissions";
import {
  answerSubscriptionPreCheckoutQuery,
  applySuccessfulSubscriptionPayment,
  cancelOrganizationSubscription,
  createOrganizationSubscriptionInvoice,
  getOrganizationSubscriptionPayload,
  grantOrganizationSubscription,
  toOrganizationSubscriptionPayload
} from "~/server/domain/subscriptions";
import {
  getSystemOrganizationDetail,
  getSystemOrganizations,
  getSystemPulse,
  getSystemStars,
  getSystemSubmissions,
  getSystemUserDetail,
  getSystemUsers,
  recordGuestEntryScan,
  recordSystemAuditLog
} from "~/server/domain/system";
import { syncUserContactFromTelegram, syncUserFromTelegram } from "~/server/domain/users";
import {
  createGuestEntryStartParam,
  normalizeGuestContext,
  parseGuestEntryStartParam
} from "~/server/domain/guest-entry-payload";
import {
  LOCAL_MEDIA_BUCKET,
  createMediaUploadSession,
  finalizeMediaUploadSession,
  getLocalMediaObjectBuffer,
  headLocalMediaObject,
  putLocalMediaObject
} from "~/server/media";
import { getMediaPublicUrl } from "~/server/media/public-url";
import { renderOrganizationQrPdf } from "~/server/pdf";
import {
  getTelegramBot,
  validateTelegramContactData,
  validateTelegramInitData
} from "~/server/telegram";
import { getOptionalEnv, getRequiredEnv } from "~/server/config/env";
import { isGuestMenuItemId } from "~/shared/guest-menu";
import type { GuestEntryConfigPayload } from "~/shared/guest-entry";
import {
  APP_LOCALES,
  fromPrismaLocale,
  normalizeAppLocale,
  toPrismaLocale
} from "~/shared/i18n/config";
import { createTranslator } from "~/shared/i18n/server";
import {
  DEFAULT_ORGANIZATION_PRESET_ID,
  ORGANIZATION_PRESET_IDS
} from "~/shared/organization-presets";
import { createSubmissionRequestSchema, submissionKindSchema } from "~/shared/submissions";
import { isAdminAnalyticsPeriod } from "~/shared/analytics";
import { isSystemPulsePeriod } from "~/shared/system";
import {
  QR_DEFAULT_CUSTOM_COLORS,
  QR_EMOJI_OPACITY_MAX,
  QR_EMOJI_OPACITY_MIN,
  QR_FORMATS,
  QR_VISUAL_STYLES,
  createQrPdfFileName,
  type QrFormatId
} from "~/shared/qr";
import { SUBSCRIPTION_PLANS, getAnnualSubscriptionDiscountPercent } from "~/shared/subscriptions";
import { TIME_ZONE_MAX_LENGTH } from "~/shared/time-zone";

const telegramInitDataHeader = "X-Telegram-Init-Data";
const telegramWebhookSecretHeader = "X-Telegram-Bot-Api-Secret-Token";
const telegramStartCoverPath = fileURLToPath(
  new URL("../assets/telegram/start-cover.jpg", import.meta.url)
);

const mediaUploadSchema = z.object({
  contentType: z.string(),
  fileName: z.string().min(1).max(180),
  kind: z.enum(["ORGANIZATION_LOGO", "STAFF_AVATAR", "SUBMISSION_PHOTO"]),
  ownerId: z.string().min(1),
  ownerType: z.enum(["ORGANIZATION", "STAFF_MEMBER", "SUBMISSION", "USER"])
});

const tmaLocaleSchema = z.object({
  initData: z.string().min(1),
  locale: z.enum(APP_LOCALES)
});

const tmaContactSchema = z.object({
  contactData: z.string().min(1),
  initData: z.string().min(1)
});

const guestMenuItemSchema = z.object({
  enabled: z.boolean()
});

const adminOrganizationSchema = z.object({
  businessType: z.enum(ORGANIZATION_PRESET_IDS).default(DEFAULT_ORGANIZATION_PRESET_ID),
  contactText: z.string().trim().max(120).optional(),
  locale: z.enum(APP_LOCALES).optional(),
  name: z.string().trim().min(2).max(80),
  timeZone: z.string().trim().max(TIME_ZONE_MAX_LENGTH).optional()
});

const adminOrganizationLogoSchema = z.object({
  logoMediaAssetId: z.string().min(1)
});

const staffMemberSchema = z.object({
  avatarMediaAssetId: z.string().min(1).nullable().optional(),
  displayName: z.string().trim().min(2).max(80),
  roleTitle: z.string().trim().max(80).optional()
});

const staffMemberPatchSchema = z
  .object({
    avatarMediaAssetId: z.string().min(1).nullable().optional(),
    displayName: z.string().trim().min(2).max(80).optional(),
    isActive: z.boolean().optional(),
    roleTitle: z.string().trim().max(80).optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one staff member field is required."
  });

const subscriptionInvoiceSchema = z.object({
  planCode: z.enum(["MONTHLY", "ANNUAL"])
});

const systemSubscriptionGrantSchema = z.object({
  planCode: z.enum(["MONTHLY", "ANNUAL"]).default("ANNUAL"),
  reason: z.string().trim().max(160).optional()
});

const systemSubscriptionCancelSchema = z.object({
  reason: z.string().trim().max(160).optional()
});

const qrHexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const qrCaptionMaxLength = Math.max(...QR_FORMATS.map((format) => format.captionMaxLength));
const qrHeadlineMaxLength = Math.max(...QR_FORMATS.map((format) => format.headlineMaxLength));

const organizationQrPdfSchema = z.object({
  caption: z.string().trim().max(qrCaptionMaxLength).optional(),
  context: z.string().trim().max(80).optional(),
  customColors: z
    .object({
      background: qrHexColorSchema.default(QR_DEFAULT_CUSTOM_COLORS.background),
      paper: qrHexColorSchema.default(QR_DEFAULT_CUSTOM_COLORS.paper),
      text: qrHexColorSchema.default(QR_DEFAULT_CUSTOM_COLORS.text)
    })
    .optional(),
  emojiOpacity: z.number().min(QR_EMOJI_OPACITY_MIN).max(QR_EMOJI_OPACITY_MAX).optional(),
  emojiThemeId: z.enum(["calm", "great", "idea", "issue", "none", "warm"]).optional(),
  formatId: z
    .enum(QR_FORMATS.map((format) => format.id) as [QrFormatId, ...QrFormatId[]])
    .optional(),
  headline: z.string().trim().max(qrHeadlineMaxLength).optional(),
  qrStyle: z.enum(QR_VISUAL_STYLES).optional(),
  showContext: z.boolean().optional()
});

const isNonProduction = () => process.env.NODE_ENV !== "production";

const databaseRequired = (c: Context) => c.json({ error: "Database is required." }, 503);

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const guestEntryConfigCache = new Map<
  string,
  {
    expiresAt: number;
    value: Promise<GuestEntryConfigPayload>;
  }
>();
const guestEntryConfigCacheTtlMs = 20_000;
const guestEntryConfigCacheMaxEntries = 500;

const getClientAddress = (c: Context) => {
  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();

  return c.req.header("cf-connecting-ip") ?? forwardedFor ?? "unknown";
};

const enforceRateLimit = (
  c: Context,
  {
    key,
    limit,
    windowMs
  }: {
    key: string;
    limit: number;
    windowMs: number;
  }
) => {
  const now = Date.now();
  const current = rateLimitBuckets.get(key);

  if (rateLimitBuckets.size > 5000) {
    for (const [bucketKey, bucket] of rateLimitBuckets.entries()) {
      if (bucket.resetAt <= now) {
        rateLimitBuckets.delete(bucketKey);
      }
    }
  }

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return null;
  }

  current.count += 1;

  if (current.count <= limit) {
    return null;
  }

  return c.json({ error: "Too many requests. Please try again later." }, 429);
};

const getCachedGuestEntryConfig = ({
  db,
  startParam
}: {
  db: NonNullable<ReturnType<typeof getPrisma>>;
  startParam: string;
}) => {
  const now = Date.now();
  const cached = guestEntryConfigCache.get(startParam);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (guestEntryConfigCache.size >= guestEntryConfigCacheMaxEntries) {
    for (const [key, item] of guestEntryConfigCache.entries()) {
      if (item.expiresAt <= now || guestEntryConfigCache.size >= guestEntryConfigCacheMaxEntries) {
        guestEntryConfigCache.delete(key);
      }
    }
  }

  const value = getGuestEntryConfig(
    {
      startParam
    },
    db
  ).catch((error) => {
    guestEntryConfigCache.delete(startParam);
    throw error;
  });

  guestEntryConfigCache.set(startParam, {
    expiresAt: now + guestEntryConfigCacheTtlMs,
    value
  });

  return value;
};

const getTelegramInitDataFromRequest = (c: {
  req: {
    header: (name: string) => string | undefined;
  };
}) => {
  const headerInitData = c.req.header(telegramInitDataHeader);
  const authorization = c.req.header("Authorization");

  if (headerInitData) {
    return headerInitData;
  }

  if (!authorization) {
    return undefined;
  }

  const [scheme, value] = authorization.split(" ");

  return scheme?.toLowerCase() === "tma" && value ? value : undefined;
};

const getValidatedTelegramUser = (initData: string) => {
  const validated = validateTelegramInitData({
    botToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
    initData
  });

  if (!validated.user) {
    throw new Error("Telegram user is required.");
  }

  return {
    ...validated,
    user: validated.user
  };
};

const getTelegramMiniAppUrl = (startParam: string) => {
  const botUsername = getOptionalEnv("TELEGRAM_BOT_USERNAME") ?? "izohappbot";

  return `https://t.me/${botUsername}/app?startapp=${encodeURIComponent(startParam)}`;
};

const requireOrganizationOwner = async ({
  c,
  db,
  organizationId
}: {
  c: Parameters<typeof getTelegramInitDataFromRequest>[0];
  db: NonNullable<ReturnType<typeof getPrisma>>;
  organizationId: string;
}) => {
  const initData = getTelegramInitDataFromRequest(c);

  if (!initData && isNonProduction()) {
    return null;
  }

  if (!initData) {
    throw new Error("Telegram init data is required.");
  }

  const validated = getValidatedTelegramUser(initData);
  const user = await syncUserFromTelegram(validated.user, db);
  const organization = await db.organization.findFirst({
    select: {
      id: true
    },
    where: {
      id: organizationId,
      owner_user_id: user.id,
      status: "ACTIVE"
    }
  });

  if (!organization) {
    throw new Error("Organization is not available.");
  }

  return user;
};

const requireSystemAdmin = async ({
  c,
  db
}: {
  c: Parameters<typeof getTelegramInitDataFromRequest>[0];
  db: NonNullable<ReturnType<typeof getPrisma>>;
}) => {
  const initData = getTelegramInitDataFromRequest(c);

  if (!initData) {
    throw new Error("Telegram init data is required.");
  }

  const validated = getValidatedTelegramUser(initData);
  const user = await syncUserFromTelegram(validated.user, db);

  if (user.system_role !== "ADMIN") {
    throw new Error("System admin access is required.");
  }

  return user;
};

const getAdminAccessStatus = (error: Error) => {
  if (
    error.message.includes("Telegram init data") ||
    error.message.includes("Telegram user is required")
  ) {
    return 401;
  }

  if (error.message.includes("Organization is not available")) return 404;

  return null;
};

const getSystemAccessStatus = (error: Error) => {
  if (
    error.message.includes("Telegram init data") ||
    error.message.includes("Telegram user is required")
  ) {
    return 401;
  }

  if (error.message.includes("System admin access")) return 403;

  return null;
};

type TelegramWebhookUpdate = {
  message?: {
    chat?: {
      id?: number | string;
      title?: string;
      type?: string;
    };
    contact?: {
      phone_number?: string;
      user_id?: number | string;
    };
    from?: {
      first_name?: string;
      id?: number | string;
      language_code?: string;
      last_name?: string;
      username?: string;
    };
    successful_payment?: {
      currency?: string;
      invoice_payload?: string;
      is_first_recurring?: boolean;
      is_recurring?: boolean;
      provider_payment_charge_id?: string;
      subscription_expiration_date?: number;
      telegram_payment_charge_id?: string;
      total_amount?: number;
    };
    text?: string;
  };
  my_chat_member?: {
    chat?: {
      id?: number | string;
      title?: string;
      type?: string;
    };
    new_chat_member?: {
      status?: string;
    };
  };
  pre_checkout_query?: {
    currency?: string;
    id?: string;
    invoice_payload?: string;
    total_amount?: number;
  };
};

const parseTelegramBigIntId = (value: number | string | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();

  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  return BigInt(normalized);
};

export const parseTelegramGroupConnectTokenCommand = (text: string | undefined) => {
  const [command, token] = (text ?? "").trim().split(/\s+/);

  if (!command) {
    return null;
  }

  const normalizedCommand = command.split("@")[0]?.toLowerCase();

  if (normalizedCommand !== "/start" || !token) {
    return null;
  }

  return token.trim().toUpperCase();
};

const parseTelegramStartCommand = (text: string | undefined) => {
  const [command, payload] = (text ?? "").trim().split(/\s+/);

  if (!command) {
    return null;
  }

  const normalizedCommand = command.split("@")[0]?.toLowerCase();

  if (normalizedCommand !== "/start") {
    return null;
  }

  return {
    payload: payload?.trim() || ""
  };
};

const sendTelegramWebhookMessage = async ({ chatId, text }: { chatId: bigint; text: string }) => {
  try {
    await getTelegramBot().api.sendMessage(chatId.toString(), text);
  } catch (error) {
    console.warn("Telegram webhook confirmation message failed", {
      chatId: chatId.toString(),
      error: error instanceof Error ? error.message : String(error)
    });
    // Webhook processing should not fail just because the confirmation message could not be sent.
  }
};

const sendTelegramStartMessage = async ({ chatId, text }: { chatId: bigint; text: string }) => {
  if (!existsSync(telegramStartCoverPath)) {
    await sendTelegramWebhookMessage({ chatId, text });
    return;
  }

  try {
    await getTelegramBot().api.sendPhoto(chatId.toString(), new InputFile(telegramStartCoverPath), {
      caption: text
    });
  } catch (error) {
    console.warn("Telegram start photo failed, sending text instead", {
      chatId: chatId.toString(),
      error: error instanceof Error ? error.message : String(error)
    });

    await sendTelegramWebhookMessage({ chatId, text });
  }
};

const handleTelegramWebhookUpdate = async (
  update: TelegramWebhookUpdate,
  db: NonNullable<ReturnType<typeof getPrisma>>
) => {
  const preCheckoutQuery = update.pre_checkout_query;

  if (preCheckoutQuery?.id && preCheckoutQuery.invoice_payload) {
    await answerSubscriptionPreCheckoutQuery(
      {
        currency: preCheckoutQuery.currency ?? "",
        id: preCheckoutQuery.id,
        invoicePayload: preCheckoutQuery.invoice_payload,
        totalAmount: preCheckoutQuery.total_amount ?? 0
      },
      db
    );

    return;
  }

  const successfulPayment = update.message?.successful_payment;

  if (
    successfulPayment?.invoice_payload &&
    successfulPayment.telegram_payment_charge_id &&
    successfulPayment.currency === "XTR"
  ) {
    await applySuccessfulSubscriptionPayment(
      {
        invoicePayload: successfulPayment.invoice_payload,
        isFirstRecurring: successfulPayment.is_first_recurring,
        isRecurring: successfulPayment.is_recurring,
        providerPaymentChargeId: successfulPayment.provider_payment_charge_id,
        rawPayload: successfulPayment,
        subscriptionExpirationDate: successfulPayment.subscription_expiration_date
          ? new Date(successfulPayment.subscription_expiration_date * 1000)
          : undefined,
        telegramPaymentChargeId: successfulPayment.telegram_payment_charge_id,
        totalAmount: successfulPayment.total_amount ?? 0
      },
      db
    );

    return;
  }

  const membership = update.my_chat_member;
  const newStatus = membership?.new_chat_member?.status;
  const membershipChatId = parseTelegramBigIntId(membership?.chat?.id);

  if (membershipChatId && (newStatus === "left" || newStatus === "kicked")) {
    await markTelegramGroupDisconnectedByChatId(
      {
        telegramChatId: membershipChatId
      },
      db
    );

    return;
  }

  const contact = update.message?.contact;
  const contactUserId = parseTelegramBigIntId(contact?.user_id);
  const messageUserId = parseTelegramBigIntId(update.message?.from?.id);

  if (contact?.phone_number && contactUserId && messageUserId && contactUserId === messageUserId) {
    await syncUserContactFromTelegram(
      {
        firstName: update.message?.from?.first_name,
        languageCode: update.message?.from?.language_code,
        lastName: update.message?.from?.last_name,
        phoneNumber: contact.phone_number,
        telegramId: messageUserId,
        username: update.message?.from?.username
      },
      db
    );

    return;
  }

  const token = parseTelegramGroupConnectTokenCommand(update.message?.text);
  const chatId = parseTelegramBigIntId(update.message?.chat?.id);

  if (!token) {
    const startCommand = parseTelegramStartCommand(update.message?.text);
    const chatType = update.message?.chat?.type;

    if (startCommand && !startCommand.payload && chatId && chatType === "private") {
      const t = createTranslator(normalizeAppLocale(update.message?.from?.language_code));

      await sendTelegramStartMessage({
        chatId,
        text: t("telegram.start.message")
      });
    }

    return;
  }

  const userId = parseTelegramBigIntId(update.message?.from?.id);

  if (!chatId) {
    return;
  }

  const chatType = update.message?.chat?.type;

  if (chatType !== "group" && chatType !== "supergroup") return;

  try {
    const connectResult = await connectTelegramGroupByToken(
      {
        token,
        telegramChatId: chatId,
        telegramChatTitle: update.message?.chat?.title,
        telegramUserId: userId ?? undefined
      },
      db
    );
    const t = createTranslator(fromPrismaLocale(connectResult.ownerLocale));

    await sendTelegramWebhookMessage({
      chatId,
      text: t("telegram.groupConnect.success", {
        organizationName: connectResult.organizationName
      })
    });
  } catch (error) {
    const connectError = error instanceof TelegramGroupConnectError ? error : null;
    const errorLocale = connectError?.ownerLocale
      ? fromPrismaLocale(connectError.ownerLocale)
      : normalizeAppLocale(update.message?.from?.language_code);
    const t = createTranslator(errorLocale);

    await sendTelegramWebhookMessage({
      chatId,
      text: t(
        connectError?.reason === "OWNER_MISMATCH"
          ? "telegram.groupConnect.errorOwner"
          : "telegram.groupConnect.errorInvalid"
      )
    });
  }
};

const resolveSubmissionGuestContext = async ({
  db,
  organizationId,
  startParam
}: {
  db: NonNullable<ReturnType<typeof getPrisma>> | null;
  organizationId: string;
  startParam?: string;
}) => {
  if (!startParam) {
    return undefined;
  }

  try {
    const payload = parseGuestEntryStartParam(startParam);

    if (payload.organizationRef !== organizationId) {
      const organization = db
        ? await db.organization.findUnique({
            select: {
              slug: true
            },
            where: {
              id: organizationId
            }
          })
        : null;

      if (organization?.slug !== payload.organizationRef) {
        throw new Error("Guest entry payload organization does not match submission organization.");
      }
    }

    if (!payload.contextCode) {
      return undefined;
    }

    if (!db) {
      throw new Error("Guest entry context is not available.");
    }

    const guestContext = await getOrganizationGuestContextByCode(
      {
        code: payload.contextCode,
        organizationId
      },
      db
    );

    if (!guestContext) {
      throw new Error("Guest entry context is not available.");
    }

    return guestContext.label;
  } catch (error) {
    if (isNonProduction() && startParam === organizationId) {
      return undefined;
    }

    throw error;
  }
};

const resolveSubmissionGuestEntryScanId = async ({
  customerUserId,
  db,
  organizationId,
  scanId,
  startParam
}: {
  customerUserId?: string;
  db: NonNullable<ReturnType<typeof getPrisma>>;
  organizationId: string;
  scanId?: string;
  startParam?: string;
}) => {
  if (!scanId) {
    return undefined;
  }

  if (!startParam) {
    throw new Error("Guest entry scan is not available.");
  }

  const scan = await db.guestEntryScan.findFirst({
    select: {
      id: true,
      user_id: true
    },
    where: {
      id: scanId,
      organization_id: organizationId,
      start_param: startParam
    }
  });

  if (!scan) {
    throw new Error("Guest entry scan is not available.");
  }

  if (customerUserId && scan.user_id && scan.user_id !== customerUserId) {
    throw new Error("Guest entry scan does not match this guest.");
  }

  return scan.id;
};

export const createApiApp = () => {
  const app = new Hono();

  app.use(
    "*",
    cors({
      allowHeaders: [
        "Content-Type",
        "Authorization",
        telegramInitDataHeader,
        telegramWebhookSecretHeader
      ],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
      origin: (origin) => origin
    })
  );

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      service: "izoh"
    })
  );

  app.post("/api/telegram/webhook", async (c) => {
    const expectedSecret = getOptionalEnv("TELEGRAM_WEBHOOK_SECRET");
    const receivedSecret = c.req.header(telegramWebhookSecretHeader);
    const db = getPrisma();

    if (!expectedSecret && !isNonProduction()) {
      return c.json({ error: "Telegram webhook secret is not configured." }, 503);
    }

    if (expectedSecret && receivedSecret !== expectedSecret) {
      return c.json({ error: "Invalid Telegram webhook secret." }, 401);
    }

    if (!db) {
      return databaseRequired(c);
    }

    await handleTelegramWebhookUpdate((await c.req.json()) as TelegramWebhookUpdate, db);

    return c.json({
      ok: true
    });
  });

  app.get("/api/admin/organizations", async (c) => {
    const db = getPrisma();
    const initData = getTelegramInitDataFromRequest(c);

    if (!db) {
      return databaseRequired(c);
    }

    if (!initData) {
      return c.json({ error: "Telegram init data is required." }, 401);
    }

    try {
      const validated = getValidatedTelegramUser(initData);
      const user = await syncUserFromTelegram(validated.user, db);

      return c.json({
        ...(await getAdminOrganizations(user.id, db)),
        viewer: {
          isSystemAdmin: user.system_role === "ADMIN",
          systemRole: user.system_role
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Telegram")) {
        return c.json({ error: error.message }, 401);
      }

      if (error instanceof Error && error.message.includes("Organization limit reached")) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }
  });

  app.get("/api/system/pulse", async (c) => {
    const periodQuery = c.req.query("period")?.trim() || "7D";
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    if (!isSystemPulsePeriod(periodQuery)) {
      return c.json({ error: "Invalid system pulse period." }, 400);
    }

    try {
      await requireSystemAdmin({ c, db });

      return c.json(await getSystemPulse({ period: periodQuery }, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getSystemAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      throw error;
    }
  });

  app.get("/api/system/organizations", async (c) => {
    const cursor = c.req.query("cursor")?.trim() || undefined;
    const periodQuery = c.req.query("period")?.trim() || "7D";
    const search = c.req.query("search")?.trim() || undefined;
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    if (!isSystemPulsePeriod(periodQuery)) {
      return c.json({ error: "Invalid system pulse period." }, 400);
    }

    try {
      await requireSystemAdmin({ c, db });

      return c.json(await getSystemOrganizations({ cursor, period: periodQuery, search }, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getSystemAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      throw error;
    }
  });

  app.get("/api/system/organizations/:organizationId", async (c) => {
    const cursor = c.req.query("cursor")?.trim() || undefined;
    const organizationId = c.req.param("organizationId");
    const periodQuery = c.req.query("period")?.trim() || "7D";
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    if (!isSystemPulsePeriod(periodQuery)) {
      return c.json({ error: "Invalid system pulse period." }, 400);
    }

    try {
      await requireSystemAdmin({ c, db });

      return c.json(
        await getSystemOrganizationDetail({ cursor, organizationId, period: periodQuery }, db)
      );
    } catch (error) {
      if (error instanceof Error) {
        const status = getSystemAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/api/system/users", async (c) => {
    const cursor = c.req.query("cursor")?.trim() || undefined;
    const periodQuery = c.req.query("period")?.trim() || "7D";
    const search = c.req.query("search")?.trim() || undefined;
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    if (!isSystemPulsePeriod(periodQuery)) {
      return c.json({ error: "Invalid system pulse period." }, 400);
    }

    try {
      await requireSystemAdmin({ c, db });

      return c.json(await getSystemUsers({ cursor, period: periodQuery, search }, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getSystemAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      throw error;
    }
  });

  app.get("/api/system/users/:userId", async (c) => {
    const cursor = c.req.query("cursor")?.trim() || undefined;
    const userId = c.req.param("userId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireSystemAdmin({ c, db });

      return c.json(await getSystemUserDetail({ cursor, userId }, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getSystemAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("User is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/api/system/submissions", async (c) => {
    const cursor = c.req.query("cursor")?.trim() || undefined;
    const periodQuery = c.req.query("period")?.trim() || "7D";
    const search = c.req.query("search")?.trim() || undefined;
    const kindQuery = c.req.query("kind")?.trim() || undefined;
    const kind = kindQuery ? submissionKindSchema.parse(kindQuery) : undefined;
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    if (!isSystemPulsePeriod(periodQuery)) {
      return c.json({ error: "Invalid system pulse period." }, 400);
    }

    try {
      await requireSystemAdmin({ c, db });

      return c.json(await getSystemSubmissions({ cursor, kind, period: periodQuery, search }, db));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: "Invalid submissions filter." }, 400);
      }

      if (error instanceof Error) {
        const status = getSystemAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      throw error;
    }
  });

  app.get("/api/system/stars", async (c) => {
    const cursor = c.req.query("cursor")?.trim() || undefined;
    const periodQuery = c.req.query("period")?.trim() || "7D";
    const search = c.req.query("search")?.trim() || undefined;
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    if (!isSystemPulsePeriod(periodQuery)) {
      return c.json({ error: "Invalid system pulse period." }, 400);
    }

    try {
      await requireSystemAdmin({ c, db });

      return c.json(await getSystemStars({ cursor, period: periodQuery, search }, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getSystemAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      throw error;
    }
  });

  app.post("/api/system/organizations/:organizationId/subscription/grant", async (c) => {
    const organizationId = c.req.param("organizationId");
    const input = systemSubscriptionGrantSchema.parse(await c.req.json());
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      const user = await requireSystemAdmin({ c, db });
      const subscription = await grantOrganizationSubscription(
        {
          grantedByUserId: user.id,
          organizationId,
          planCode: input.planCode,
          reason: input.reason
        },
        db
      );
      await recordSystemAuditLog(
        {
          action: "SUBSCRIPTION_GRANTED",
          actorUserId: user.id,
          metadata: {
            planCode: input.planCode,
            reason: input.reason ?? null
          },
          targetId: organizationId,
          targetType: "ORGANIZATION"
        },
        db
      );

      return c.json({
        subscription: toOrganizationSubscriptionPayload(subscription)
      });
    } catch (error) {
      if (error instanceof Error) {
        const status = getSystemAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.post("/api/system/organizations/:organizationId/subscription/cancel", async (c) => {
    const organizationId = c.req.param("organizationId");
    const input = systemSubscriptionCancelSchema.parse(await c.req.json());
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      const user = await requireSystemAdmin({ c, db });
      const subscription = await cancelOrganizationSubscription(
        {
          actorUserId: user.id,
          organizationId,
          reason: input.reason
        },
        db
      );
      await recordSystemAuditLog(
        {
          action: "SUBSCRIPTION_CANCELED",
          actorUserId: user.id,
          metadata: {
            reason: input.reason ?? null
          },
          targetId: organizationId,
          targetType: "ORGANIZATION"
        },
        db
      );

      return c.json({
        subscription: toOrganizationSubscriptionPayload(subscription)
      });
    } catch (error) {
      if (error instanceof Error) {
        const status = getSystemAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.post("/api/admin/organizations", async (c) => {
    const input = adminOrganizationSchema.parse(await c.req.json());
    const locale = toPrismaLocale(normalizeAppLocale(input.locale));
    const db = getPrisma();
    const initData = getTelegramInitDataFromRequest(c);

    if (!db) {
      return databaseRequired(c);
    }

    if (!initData) {
      return c.json({ error: "Telegram init data is required." }, 401);
    }

    try {
      const validated = getValidatedTelegramUser(initData);
      const user = await syncUserFromTelegram(validated.user, db);

      return c.json(
        await createAdminOrganization(
          {
            contactText: input.contactText,
            locale,
            name: input.name,
            ownerUserId: user.id,
            presetId: input.businessType,
            timeZone: input.timeZone
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("Telegram")) {
        return c.json({ error: error.message }, 401);
      }

      throw error;
    }
  });

  app.delete("/api/admin/organizations/:organizationId", async (c) => {
    const organizationId = c.req.param("organizationId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      const user = await requireOrganizationOwner({ c, db, organizationId });

      return c.json(
        await enqueueAdminOrganizationDeletion(
          {
            organizationId,
            requestedByUserId: user?.id
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      throw error;
    }
  });

  app.patch("/api/admin/organizations/:organizationId/logo", async (c) => {
    const organizationId = c.req.param("organizationId");
    const input = adminOrganizationLogoSchema.parse(await c.req.json());
    const db = getPrisma();
    const initData = getTelegramInitDataFromRequest(c);

    if (!db) {
      return databaseRequired(c);
    }

    if (!initData) {
      return c.json({ error: "Telegram init data is required." }, 401);
    }

    try {
      const validated = getValidatedTelegramUser(initData);
      const user = await syncUserFromTelegram(validated.user, db);

      return c.json(
        await updateAdminOrganizationLogo(
          {
            logoMediaAssetId: input.logoMediaAssetId,
            organizationId,
            userId: user.id
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("Telegram")) {
        return c.json({ error: error.message }, 401);
      }

      if (error instanceof Error && error.message.includes("Organization")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/api/organizations/:organizationId/qr-link", async (c) => {
    const organizationId = c.req.param("organizationId");
    const qrContext = normalizeGuestContext(c.req.query("context"));
    const db = getPrisma();
    let contextCode: string | undefined;
    let organizationRef = organizationId;

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });
      const organization = await db.organization.findUnique({
        select: {
          id: true,
          slug: true
        },
        where: {
          id: organizationId
        }
      });

      if (!organization) {
        return c.json({ error: "Organization is not available." }, 404);
      }

      organizationRef = organization.slug;

      if (qrContext) {
        const guestContext = await getOrCreateOrganizationGuestContext(
          {
            label: qrContext,
            organizationId: organization.id
          },
          db
        );

        contextCode = guestContext?.code;
      }
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      throw error;
    }

    const startParam = createGuestEntryStartParam({ contextCode, organizationRef });

    return c.json({
      startParam,
      url: getTelegramMiniAppUrl(startParam)
    });
  });

  app.post("/api/organizations/:organizationId/qr-pdf", async (c) => {
    const organizationId = c.req.param("organizationId");
    const shouldSendToChat = c.req.query("delivery") === "chat";
    const input = organizationQrPdfSchema.parse(await c.req.json());
    const qrContext = normalizeGuestContext(input.context);
    const db = getPrisma();
    let contextCode: string | undefined;

    if (!db) {
      return databaseRequired(c);
    }

    try {
      const user = await requireOrganizationOwner({ c, db, organizationId });
      const organization = await db.organization.findUnique({
        select: {
          id: true,
          locale: true,
          logo_media_asset_id: true,
          name: true,
          slug: true
        },
        where: {
          id: organizationId
        }
      });

      if (!organization) {
        return c.json({ error: "Organization is not available." }, 404);
      }

      if (qrContext) {
        const guestContext = await getOrCreateOrganizationGuestContext(
          {
            label: qrContext,
            organizationId: organization.id
          },
          db
        );

        contextCode = guestContext?.code;
      }

      const logoAsset = organization.logo_media_asset_id
        ? await db.mediaAsset.findFirst({
            select: {
              bucket: true,
              public_url: true,
              storage_key: true
            },
            where: {
              id: organization.logo_media_asset_id,
              kind: "ORGANIZATION_LOGO",
              owner_id: organization.id,
              owner_type: "ORGANIZATION",
              status: "READY"
            }
          })
        : null;
      const startParam = createGuestEntryStartParam({
        contextCode,
        organizationRef: organization.slug
      });
      const pdf = await renderOrganizationQrPdf({
        locale: fromPrismaLocale(organization.locale),
        organizationLogoUrl: logoAsset ? getMediaPublicUrl(logoAsset) : null,
        organizationName: organization.name,
        template: {
          ...input,
          context: qrContext
        },
        url: getTelegramMiniAppUrl(startParam)
      });
      const fileName = createQrPdfFileName({
        context: qrContext,
        organizationName: organization.name,
        organizationSlug: organization.slug
      });

      if (shouldSendToChat) {
        if (!user) {
          return c.json({ error: "Telegram user is required." }, 401);
        }

        await getTelegramBot().api.sendDocument(
          user.telegram_id.toString(),
          new InputFile(pdf, fileName)
        );

        return c.json({ ok: true });
      }

      return new Response(new Uint8Array(pdf), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Type": "application/pdf"
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      throw error;
    }
  });

  const handleGuestEntryConfigRequest = async (c: Context) => {
    const startParam = c.req.param("startParam");
    const db = getPrisma();
    const initData = getTelegramInitDataFromRequest(c);

    if (!startParam) {
      return c.json({ error: "Guest entry payload is required." }, 400);
    }

    if (!db) {
      return databaseRequired(c);
    }

    try {
      const guestEntryConfig = await getCachedGuestEntryConfig({
        db,
        startParam
      });
      let scanId: null | string = null;
      let userId: string | undefined;
      let userLocale: string | undefined;

      if (initData) {
        try {
          const validated = getValidatedTelegramUser(initData);
          const user = await syncUserFromTelegram(validated.user, db);

          userId = user.id;
          userLocale = user.locale;
        } catch (error) {
          console.warn("Guest entry user sync failed for scan analytics", {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      try {
        const scan = await recordGuestEntryScan(
          {
            locale: userLocale,
            organizationId: guestEntryConfig.organization.id,
            qrContext: guestEntryConfig.qrContext,
            startParam,
            userId
          },
          db
        );

        scanId = scan.id;
      } catch (error) {
        console.warn("Guest entry scan analytics failed", {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      return c.json({
        ...guestEntryConfig,
        scanId
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("Organization is not available") ||
          error.message.includes("Guest entry payload"))
      ) {
        return c.json({ error: error.message }, 404);
      }

      if (error instanceof Error && error.message.includes("Guest entry context")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  };

  app.get("/api/guest-entry/:startParam", handleGuestEntryConfigRequest);

  app.get("/api/organizations/:organizationId/guest-menu", async (c) => {
    const organizationId = c.req.param("organizationId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(await getOrganizationGuestMenu(organizationId, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      if (error instanceof Error && error.message.includes("Staff avatar is not available")) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }
  });

  app.get("/api/organizations/:organizationId/guest-menu/:itemId", async (c) => {
    const organizationId = c.req.param("organizationId");
    const itemId = c.req.param("itemId");

    if (!isGuestMenuItemId(itemId)) {
      return c.json({ error: "Guest menu item is unknown." }, 400);
    }

    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      const guestMenu = await getOrganizationGuestMenu(organizationId, db);
      const item = guestMenu.items.find((menuItem) => menuItem.id === itemId);

      return c.json({
        item,
        organizationId
      });
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.patch("/api/organizations/:organizationId/guest-menu/:itemId", async (c) => {
    const organizationId = c.req.param("organizationId");
    const itemId = c.req.param("itemId");
    const input = guestMenuItemSchema.parse(await c.req.json());

    if (!isGuestMenuItemId(itemId)) {
      return c.json({ error: "Guest menu item is unknown." }, 400);
    }

    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(
        await updateOrganizationGuestMenuItem(
          {
            enabled: input.enabled,
            itemId,
            organizationId
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/api/organizations/:organizationId/staff-members", async (c) => {
    const organizationId = c.req.param("organizationId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(await getOrganizationStaffMembers(organizationId, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.post("/api/organizations/:organizationId/staff-members", async (c) => {
    const organizationId = c.req.param("organizationId");
    const input = staffMemberSchema.parse(await c.req.json());
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(
        await createOrganizationStaffMember(
          {
            displayName: input.displayName,
            organizationId,
            roleTitle: input.roleTitle
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/api/organizations/:organizationId/staff-members/:staffMemberId", async (c) => {
    const organizationId = c.req.param("organizationId");
    const staffMemberId = c.req.param("staffMemberId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(await getOrganizationStaffMember({ organizationId, staffMemberId }, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      if (error instanceof Error && error.message.includes("Staff member is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.patch("/api/organizations/:organizationId/staff-members/:staffMemberId", async (c) => {
    const organizationId = c.req.param("organizationId");
    const staffMemberId = c.req.param("staffMemberId");
    const patch = staffMemberPatchSchema.parse(await c.req.json());
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(
        await updateOrganizationStaffMember(
          {
            organizationId,
            patch,
            staffMemberId
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      if (error instanceof Error && error.message.includes("Staff member is not available")) {
        return c.json({ error: error.message }, 404);
      }

      if (error instanceof Error && error.message.includes("Staff avatar is not available")) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }
  });

  app.delete("/api/organizations/:organizationId/staff-members/:staffMemberId", async (c) => {
    const organizationId = c.req.param("organizationId");
    const staffMemberId = c.req.param("staffMemberId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(await deleteOrganizationStaffMember({ organizationId, staffMemberId }, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      if (error instanceof Error && error.message.includes("Staff member is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/api/organizations/:organizationId/modules/:itemId/settings", async (c) => {
    const organizationId = c.req.param("organizationId");
    const itemId = c.req.param("itemId");

    if (!isGuestMenuItemId(itemId)) {
      return c.json({ error: "Module settings item is unknown." }, 400);
    }

    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(await getOrganizationModuleSettings({ itemId, organizationId }, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.patch("/api/organizations/:organizationId/modules/:itemId/settings", async (c) => {
    const organizationId = c.req.param("organizationId");
    const itemId = c.req.param("itemId");

    if (!isGuestMenuItemId(itemId)) {
      return c.json({ error: "Module settings item is unknown." }, 400);
    }

    const patch = await c.req.json();
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(await updateOrganizationModuleSettings({ itemId, organizationId, patch }, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/api/organizations/:organizationId/notifications", async (c) => {
    const organizationId = c.req.param("organizationId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(await getOrganizationNotificationSettings(organizationId, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.patch("/api/organizations/:organizationId/notifications/targets/:targetId", async (c) => {
    const organizationId = c.req.param("organizationId");
    const targetId = c.req.param("targetId");
    const patch = await c.req.json();
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(
        await updateOrganizationNotificationTarget(
          {
            organizationId,
            patch,
            targetId
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (
        error instanceof Error &&
        (error.message.includes("Organization is not available") ||
          error.message.includes("Notification target"))
      ) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }
  });

  app.post("/api/organizations/:organizationId/notifications/group-connect-link", async (c) => {
    const organizationId = c.req.param("organizationId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      const user = await requireOrganizationOwner({ c, db, organizationId });
      const createdByUserId =
        user?.id ??
        (
          await db.organization.findUnique({
            select: {
              owner_user_id: true
            },
            where: {
              id: organizationId
            }
          })
        )?.owner_user_id;

      if (!createdByUserId) {
        return c.json({ error: "Organization is not available." }, 404);
      }

      return c.json(
        await createOrganizationNotificationGroupConnectLink(
          {
            createdByUserId,
            organizationId
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.delete("/api/organizations/:organizationId/notifications/group", async (c) => {
    const organizationId = c.req.param("organizationId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(await disconnectOrganizationNotificationGroup(organizationId, db));
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/api/organizations/:organizationId/subscription", async (c) => {
    const organizationId = c.req.param("organizationId");
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json({
        annualDiscountPercent: getAnnualSubscriptionDiscountPercent(),
        plans: SUBSCRIPTION_PLANS,
        subscription: await getOrganizationSubscriptionPayload(organizationId, db)
      });
    } catch (error) {
      const status = error instanceof Error ? getAdminAccessStatus(error) : null;

      if (status) {
        return c.json({ error: error instanceof Error ? error.message : "Access denied." }, status);
      }

      throw error;
    }
  });

  app.post("/api/organizations/:organizationId/subscription/invoices", async (c) => {
    const organizationId = c.req.param("organizationId");
    const input = subscriptionInvoiceSchema.parse(await c.req.json());
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      const user = await requireOrganizationOwner({ c, db, organizationId });
      const organization = await db.organization.findFirst({
        select: {
          locale: true
        },
        where: {
          id: organizationId,
          status: "ACTIVE"
        }
      });

      if (!organization) {
        return c.json({ error: "Organization is not available." }, 404);
      }

      return c.json(
        await createOrganizationSubscriptionInvoice(
          {
            locale: fromPrismaLocale(organization.locale),
            organizationId,
            payerUserId: user?.id,
            planCode: input.planCode
          },
          db
        )
      );
    } catch (error) {
      const status = error instanceof Error ? getAdminAccessStatus(error) : null;

      if (status) {
        return c.json({ error: error instanceof Error ? error.message : "Access denied." }, status);
      }

      if (error instanceof Error && error.message.includes("TELEGRAM_BOT_TOKEN")) {
        return c.json({ error: "Telegram bot is not configured." }, 503);
      }

      throw error;
    }
  });

  app.get("/api/organizations/:organizationId/submissions", async (c) => {
    const organizationId = c.req.param("organizationId");
    const cursor = c.req.query("cursor")?.trim() || undefined;
    const kindQuery = c.req.query("kind")?.trim() || undefined;
    const limitQuery = Number(c.req.query("limit") ?? "");
    const kind = kindQuery ? submissionKindSchema.parse(kindQuery) : undefined;
    const limit = Number.isFinite(limitQuery) ? limitQuery : undefined;
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(
        await getOrganizationSubmissions(
          {
            cursor,
            kind,
            limit,
            organizationId
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: "Invalid submissions filter." }, 400);
      }

      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.get("/api/organizations/:organizationId/analytics", async (c) => {
    const organizationId = c.req.param("organizationId");
    const periodQuery = c.req.query("period")?.trim() || "30D";
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    if (!isAdminAnalyticsPeriod(periodQuery)) {
      return c.json({ error: "Invalid analytics period." }, 400);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(
        await getOrganizationAnalytics(
          {
            organizationId,
            period: periodQuery
          },
          db
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        const status = getAdminAccessStatus(error);

        if (status) return c.json({ error: error.message }, status);
      }

      if (error instanceof Error && error.message.includes("Organization is not available")) {
        return c.json({ error: error.message }, 404);
      }

      throw error;
    }
  });

  app.post("/api/tma/session", async (c) => {
    const { initData } = await c.req.json<{ initData?: string }>();

    if (!initData) {
      return c.json({ error: "initData is required." }, 400);
    }

    const validated = validateTelegramInitData({
      botToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
      initData
    });

    if (!validated.user) {
      return c.json({ error: "Telegram user is required." }, 400);
    }

    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    const user = await syncUserFromTelegram(validated.user, db);

    return c.json({
      startParam: validated.startParam,
      user: {
        id: user.id,
        locale: user.locale,
        localeSource: user.locale_source,
        phoneNumber: user.phone_number,
        telegramId: user.telegram_id.toString(),
        username: user.username
      }
    });
  });

  app.post("/api/tma/contact", async (c) => {
    const input = tmaContactSchema.parse(await c.req.json());
    const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
    const validated = validateTelegramInitData({
      botToken,
      initData: input.initData
    });
    const validatedContact = validateTelegramContactData({
      botToken,
      contactData: input.contactData
    });

    if (!validated.user) {
      return c.json({ error: "Telegram user is required." }, 400);
    }

    if (String(validatedContact.contact.user_id) !== String(validated.user.id)) {
      return c.json({ error: "Telegram contact does not belong to the current user." }, 403);
    }

    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    const user = await syncUserContactFromTelegram(
      {
        firstName: validated.user.first_name,
        languageCode: validated.user.language_code,
        lastName: validated.user.last_name,
        phoneNumber: validatedContact.contact.phone_number,
        telegramId: BigInt(validated.user.id),
        username: validated.user.username
      },
      db
    );

    return c.json({
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        telegramId: user.telegram_id.toString()
      }
    });
  });

  app.post("/api/tma/locale", async (c) => {
    const input = tmaLocaleSchema.parse(await c.req.json());
    const validated = validateTelegramInitData({
      botToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
      initData: input.initData
    });

    if (!validated.user) {
      return c.json({ error: "Telegram user is required." }, 400);
    }

    const db = getPrisma();
    const locale = toPrismaLocale(input.locale);

    if (!db) {
      return databaseRequired(c);
    }

    const syncedUser = await syncUserFromTelegram(validated.user, db);
    const user = await db.user.update({
      data: {
        locale,
        locale_source: "MANUAL"
      },
      where: {
        id: syncedUser.id
      }
    });

    return c.json({
      user: {
        id: user.id,
        locale: user.locale,
        localeSource: user.locale_source,
        telegramId: user.telegram_id.toString()
      }
    });
  });

  app.post("/api/media/upload-sessions", async (c) => {
    const input = mediaUploadSchema.parse(await c.req.json());
    const rateLimitResponse = enforceRateLimit(c, {
      key: `media-upload:${getClientAddress(c)}:${input.ownerType}:${input.ownerId}:${input.kind}`,
      limit: 40,
      windowMs: 10 * 60 * 1000
    });
    const db = getPrisma();
    const initData = getTelegramInitDataFromRequest(c);
    let userId: string | undefined;

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!db) {
      return c.json({ error: "Database is required for media upload." }, 503);
    }

    if (initData) {
      try {
        const validated = getValidatedTelegramUser(initData);
        const user = await syncUserFromTelegram(validated.user, db);

        userId = user.id;
      } catch (error) {
        if (error instanceof Error && error.message.includes("Telegram")) {
          return c.json({ error: error.message }, 401);
        }

        throw error;
      }
    } else if (!initData && !isNonProduction()) {
      return c.json({ error: "Telegram init data is required." }, 401);
    }

    const session = await createMediaUploadSession(
      {
        ...input,
        userId
      },
      db
    );

    return c.json(session);
  });

  app.put("/api/media/local-upload/:sessionId", async (c) => {
    if (!isNonProduction()) {
      return c.json({ error: "Local media upload is unavailable." }, 404);
    }

    const db = getPrisma();

    if (!db) {
      return c.json({ error: "Database is required for media upload." }, 503);
    }

    const session = await db.mediaUploadSession.findUnique({
      where: {
        id: c.req.param("sessionId")
      }
    });

    if (!session || session.bucket !== LOCAL_MEDIA_BUCKET) {
      return c.json({ error: "Upload session was not found." }, 404);
    }

    const contentType = c.req.header("Content-Type") ?? "";

    if (contentType !== session.content_type) {
      return c.json(
        { error: "Uploaded file content type does not match the upload session." },
        400
      );
    }

    const body = Buffer.from(await c.req.arrayBuffer());

    if (!body.byteLength || body.byteLength > session.size_limit_bytes) {
      return c.json({ error: "Uploaded file is empty or too large." }, 400);
    }

    await putLocalMediaObject({
      body,
      contentType,
      key: session.temp_storage_key
    });
    await db.mediaUploadSession.update({
      data: {
        status: "UPLOADED",
        uploaded_at: new Date()
      },
      where: {
        id: session.id
      }
    });

    return c.json({ ok: true });
  });

  app.get("/api/media/local-assets", async (c) => {
    if (!isNonProduction()) {
      return c.json({ error: "Local media assets are unavailable." }, 404);
    }

    const key = c.req.query("key");

    if (!key) {
      return c.json({ error: "Media key is required." }, 400);
    }

    try {
      const [head, body] = await Promise.all([
        headLocalMediaObject(key),
        getLocalMediaObjectBuffer(key)
      ]);

      return new Response(body, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": head.ContentType ?? "application/octet-stream"
        }
      });
    } catch {
      return c.json({ error: "Media asset was not found." }, 404);
    }
  });

  app.post("/api/media/upload-sessions/:sessionId/finalize", async (c) => {
    const assets = await finalizeMediaUploadSession({
      sessionId: c.req.param("sessionId")
    });

    return c.json({
      assets
    });
  });

  app.post("/api/submissions", async (c) => {
    const input = createSubmissionRequestSchema.parse(await c.req.json());
    const rateLimitResponse = enforceRateLimit(c, {
      key: `submission:${getClientAddress(c)}:${input.organizationId}:${input.startParam ?? "direct"}`,
      limit: 30,
      windowMs: 10 * 60 * 1000
    });
    const db = getPrisma();
    const initData = getTelegramInitDataFromRequest(c);
    let guestEntryScanId: string | undefined;
    let qrContext: string | undefined;
    let customerUserId: string | undefined;

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!db) {
      return databaseRequired(c);
    }

    try {
      qrContext = await resolveSubmissionGuestContext({
        db,
        organizationId: input.organizationId,
        startParam: input.startParam
      });
    } catch (error) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }

    if (initData) {
      try {
        const validated = getValidatedTelegramUser(initData);
        const user = await syncUserFromTelegram(validated.user, db);

        customerUserId = user.id;
      } catch (error) {
        if (error instanceof Error && error.message.includes("Telegram")) {
          return c.json({ error: error.message }, 401);
        }

        throw error;
      }
    } else if (!isNonProduction()) {
      return c.json({ error: "Telegram init data is required." }, 401);
    }

    try {
      guestEntryScanId = await resolveSubmissionGuestEntryScanId({
        customerUserId,
        db,
        organizationId: input.organizationId,
        scanId: input.guestEntryScanId,
        startParam: input.startParam
      });
    } catch (error) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }

    try {
      const submission = await createSubmission(
        {
          ...input,
          customerUserId,
          guestEntryScanId,
          qrContext
        },
        db
      );
      const adminSubmission = await getSubmissionAdminItem(submission.id, db);

      return c.json({
        submission: adminSubmission
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("Organization is not available") ||
          error.message.includes("Staff member is not available"))
      ) {
        return c.json({ error: error.message }, 404);
      }

      if (
        error instanceof Error &&
        (error.message.includes("required") ||
          error.message.includes("disabled") ||
          error.message.includes("not available") ||
          error.message.includes("only") ||
          error.message.includes("rating") ||
          error.message.includes("topics") ||
          error.message.includes("photos"))
      ) {
        return c.json({ error: error.message }, 400);
      }

      throw error;
    }
  });

  return app;
};
