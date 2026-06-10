import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import { getPrisma } from "~/server/db";
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
  getAdminOrganizations,
  updateAdminOrganizationLogo
} from "~/server/domain/organizations";
import {
  getOrganizationNotificationSettings,
  updateOrganizationNotificationSettings
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
import { syncUserFromTelegram } from "~/server/domain/users";
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
import { validateTelegramInitData } from "~/server/telegram";
import { getOptionalEnv, getRequiredEnv } from "~/server/config/env";
import { isGuestMenuItemId } from "~/shared/guest-menu";
import { normalizeAppLocale, toPrismaLocale } from "~/shared/i18n/config";
import {
  DEFAULT_ORGANIZATION_PRESET_ID,
  ORGANIZATION_PRESET_IDS
} from "~/shared/organization-presets";
import { createSubmissionRequestSchema, submissionKindSchema } from "~/shared/submissions";

const telegramInitDataHeader = "X-Telegram-Init-Data";

const mediaUploadSchema = z.object({
  contentType: z.string(),
  fileName: z.string().min(1).max(180),
  kind: z.enum(["ORGANIZATION_LOGO", "STAFF_AVATAR", "SUBMISSION_PHOTO"]),
  ownerId: z.string().min(1),
  ownerType: z.enum(["ORGANIZATION", "STAFF_MEMBER", "SUBMISSION", "USER"])
});

const tmaLocaleSchema = z.object({
  initData: z.string().min(1),
  locale: z.enum(["ru", "uz"])
});

const guestMenuItemSchema = z.object({
  enabled: z.boolean()
});

const adminOrganizationSchema = z.object({
  businessType: z.enum(ORGANIZATION_PRESET_IDS).default(DEFAULT_ORGANIZATION_PRESET_ID),
  contactText: z.string().trim().max(120).optional(),
  locale: z.enum(["ru", "uz", "RU", "UZ"]).optional(),
  name: z.string().trim().min(2).max(80)
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

const isNonProduction = () => process.env.NODE_ENV !== "production";

const databaseRequired = (c: Context) => c.json({ error: "Database is required." }, 503);

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

export const createApiApp = () => {
  const app = new Hono();

  app.use(
    "*",
    cors({
      allowHeaders: ["Content-Type", "Authorization", telegramInitDataHeader],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
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

      return c.json(await getAdminOrganizations(user.id, db));
    } catch (error) {
      if (error instanceof Error && error.message.includes("Telegram")) {
        return c.json({ error: error.message }, 401);
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
            presetId: input.businessType
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

  const handleGuestEntryConfigRequest = async (c: Context) => {
    const startParam = c.req.param("startParam");
    const db = getPrisma();

    if (!startParam) {
      return c.json({ error: "Guest entry payload is required." }, 400);
    }

    if (!db) {
      return databaseRequired(c);
    }

    try {
      return c.json(
        await getGuestEntryConfig(
          {
            startParam
          },
          db
        )
      );
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

  app.get("/api/organizations/:organizationId/notifications/settings", async (c) => {
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

  app.patch("/api/organizations/:organizationId/notifications/settings", async (c) => {
    const organizationId = c.req.param("organizationId");
    const patch = await c.req.json();
    const db = getPrisma();

    if (!db) {
      return databaseRequired(c);
    }

    try {
      await requireOrganizationOwner({ c, db, organizationId });

      return c.json(
        await updateOrganizationNotificationSettings(
          {
            organizationId,
            patch
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
          error.message.includes("Telegram group"))
      ) {
        return c.json({ error: error.message }, 400);
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
    const db = getPrisma();
    const initData = getTelegramInitDataFromRequest(c);
    let userId: string | undefined;

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
    const db = getPrisma();
    const initData = getTelegramInitDataFromRequest(c);
    let qrContext: string | undefined;
    let customerUserId: string | undefined;

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
      const submission = await createSubmission(
        {
          ...input,
          customerUserId,
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
