import { Prisma, type PrismaClient } from "../../../prisma/generated/prisma/client";

import { getOrganizationGuestContextByCode } from "~/server/domain/guest-contexts";
import { parseGuestEntryStartParam } from "~/server/domain/guest-entry-payload";
import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { isOrganizationSubscriptionActive } from "~/server/domain/subscriptions";
import { deleteLocalMediaObject, LOCAL_MEDIA_BUCKET } from "~/server/media/local-storage";
import { getMediaPublicUrl } from "~/server/media/public-url";
import { deleteR2Object } from "~/server/media/r2-client";
import { fromPrismaLocale } from "~/shared/i18n";
import {
  getMenuCurrencyMinorUnit,
  MENU_ALLERGEN_CODES,
  MENU_CATEGORY_LIMIT,
  MENU_DIETARY_TAG_CODES,
  MENU_ITEMS_PER_CATEGORY_LIMIT,
  MENU_MARKETING_TAG_CODES,
  MENU_TOTAL_ITEM_LIMIT,
  menuCurrencyCodeSchema,
  type AdminMenuPayload,
  type AdminMenuSummaryPayload,
  type CreateMenuCategoryInput,
  type CreateMenuInput,
  type CreateMenuItemInput,
  type DeleteDetachedMenuPhotoPayload,
  type GuestMenuPayload,
  type GuestMenuSummary,
  type MenuAllergenCode,
  type MenuCategoryPayload,
  type MenuCurrencyCode,
  type MenuDietaryTagCode,
  type MenuItemPayload,
  type MenuMarketingTagCode,
  type MenuPayload,
  type ReorderMenuEntitiesInput,
  type MenuSpiceLevel,
  type UpdateMenuCategoryInput,
  type UpdateMenuInput,
  type UpdateMenuItemInput
} from "~/shared/menu";

export class MenuDomainError extends Error {
  readonly status: 400 | 404 | 409;

  constructor(message: string, status: 400 | 404 | 409) {
    super(message);
    this.name = "MenuDomainError";
    this.status = status;
  }
}

// New menu writes use enum values that older Prisma clients cannot decode. Keep production
// fail-closed until every API and worker instance is running the migration-aware client.
export const isMenuModuleRolloutEnabled = () => {
  if (process.env.NODE_ENV === "test") return true;

  const configuredValue = process.env.MENU_MODULE_ROLLOUT_ENABLED?.trim().toLowerCase();

  if (configuredValue !== undefined) return configuredValue === "true";

  return process.env.NODE_ENV === "development";
};

const assertMenuModuleRolloutEnabled = () => {
  if (!isMenuModuleRolloutEnabled()) {
    throw new MenuDomainError("Menu module is not available.", 404);
  }
};

const menuItemPhotoInclude = {
  select: {
    bucket: true,
    id: true,
    kind: true,
    owner_id: true,
    owner_type: true,
    public_url: true,
    status: true,
    storage_key: true
  }
} as const;

const menuInclude = {
  categories: {
    include: {
      items: {
        include: {
          photo_media_asset: menuItemPhotoInclude
        },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }]
      }
    },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }]
  }
} satisfies Prisma.MenuInclude;

const guestMenuInclude = {
  categories: {
    include: {
      items: {
        include: {
          photo_media_asset: menuItemPhotoInclude
        },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
        where: { is_visible: true }
      }
    },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    where: {
      is_visible: true,
      items: {
        some: { is_visible: true }
      }
    }
  }
} satisfies Prisma.MenuInclude;

type MenuRecord = Prisma.MenuGetPayload<{ include: typeof menuInclude }>;

const runMenuTransaction = async <T>(
  db: DomainDb,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
) => {
  if ("$transaction" in db) {
    return (db as PrismaClient).$transaction(operation);
  }

  return operation(db);
};

const lockMenuForMutation = async (menuId: string, db: Prisma.TransactionClient) => {
  await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Menu" WHERE "id" = ${menuId} FOR UPDATE`);
};

const bulkUpdateSortOrder = async (
  {
    entity,
    orderedIds,
    parentId
  }:
    | { entity: "category"; orderedIds: string[]; parentId: string }
    | { entity: "item"; orderedIds: string[]; parentId: string },
  db: Prisma.TransactionClient
) => {
  const orderedValues = Prisma.join(
    orderedIds.map((id, sortOrder) => Prisma.sql`(${id}::text, ${sortOrder}::integer)`)
  );

  if (entity === "category") {
    await db.$executeRaw(Prisma.sql`
      UPDATE "MenuCategory" AS category
      SET "sort_order" = ordered."sort_order"
      FROM (VALUES ${orderedValues}) AS ordered("id", "sort_order")
      WHERE category."id" = ordered."id"
        AND category."menu_id" = ${parentId}
    `);
    return;
  }

  await db.$executeRaw(Prisma.sql`
    UPDATE "MenuItem" AS item
    SET "sort_order" = ordered."sort_order"
    FROM (VALUES ${orderedValues}) AS ordered("id", "sort_order")
    WHERE item."id" = ordered."id"
      AND item."category_id" = ${parentId}
  `);
};

const filterCodes = <T extends string>(values: string[], allowed: readonly T[]) => {
  const allowedCodes = new Set<string>(allowed);

  return values.filter((value): value is T => allowedCodes.has(value));
};

const toMenuItemPayload = (
  item: MenuRecord["categories"][number]["items"][number],
  organizationId: string
): MenuItemPayload => {
  const photo = item.photo_media_asset;
  const photoIsUsable =
    photo?.kind === "MENU_ITEM_PHOTO" &&
    photo.status === "READY" &&
    photo.owner_type === "ORGANIZATION" &&
    photo.owner_id === organizationId;

  return {
    allergenCodes: filterCodes<MenuAllergenCode>(item.allergen_codes, MENU_ALLERGEN_CODES),
    categoryId: item.category_id,
    description: item.description,
    dietaryTagCodes: filterCodes<MenuDietaryTagCode>(
      item.dietary_tag_codes,
      MENU_DIETARY_TAG_CODES
    ),
    id: item.id,
    isAvailable: item.is_available,
    isVisible: item.is_visible,
    marketingTagCodes: filterCodes<MenuMarketingTagCode>(
      item.marketing_tag_codes,
      MENU_MARKETING_TAG_CODES
    ),
    name: item.name,
    photoMediaAssetId: photoIsUsable ? photo.id : null,
    photoUrl: photoIsUsable ? getMediaPublicUrl(photo) : null,
    portionLabel: item.portion_label,
    priceMinor: item.price_minor,
    sortOrder: item.sort_order,
    spiceLevel: Math.min(3, Math.max(0, item.spice_level)) as MenuSpiceLevel
  };
};

const toMenuCategoryPayload = (
  category: MenuRecord["categories"][number],
  organizationId: string,
  onlyVisible: boolean
): MenuCategoryPayload => ({
  id: category.id,
  isVisible: category.is_visible,
  items: category.items
    .filter((item) => !onlyVisible || item.is_visible)
    .map((item) => toMenuItemPayload(item, organizationId)),
  name: category.name,
  sortOrder: category.sort_order
});

const toMenuPayload = (
  menu: MenuRecord,
  organizationId: string,
  { onlyVisible = false }: { onlyVisible?: boolean } = {}
): MenuPayload => {
  const parsedCurrencyCode = menuCurrencyCodeSchema.safeParse(menu.currency_code);

  if (!parsedCurrencyCode.success) {
    throw new Error(`Unsupported stored menu currency: ${menu.currency_code}`);
  }

  const currencyCode: MenuCurrencyCode = parsedCurrencyCode.data;

  return {
    categories: menu.categories
      .filter(
        (category) =>
          !onlyVisible || (category.is_visible && category.items.some((item) => item.is_visible))
      )
      .map((category) => toMenuCategoryPayload(category, organizationId, onlyVisible)),
    contentLocale: fromPrismaLocale(menu.content_locale),
    currency: {
      code: currencyCode,
      minorUnit: getMenuCurrencyMinorUnit(currencyCode)
    },
    id: menu.id,
    revision: menu.revision
  };
};

const assertActiveOrganization = async (organizationId: string, db: DomainDb) => {
  assertMenuModuleRolloutEnabled();
  const organization = await db.organization.findFirst({
    select: {
      id: true,
      locale: true
    },
    where: {
      id: organizationId,
      status: "ACTIVE"
    }
  });

  if (!organization) {
    throw new MenuDomainError("Organization is not available.", 404);
  }

  return organization;
};

const getMenuRecord = async (organizationId: string, db: DomainDb) =>
  db.menu.findUnique({
    include: menuInclude,
    where: {
      organization_id: organizationId
    }
  });

const assertMenu = async (organizationId: string, db: DomainDb) => {
  const menu = await db.menu.findUnique({
    select: {
      id: true
    },
    where: {
      organization_id: organizationId
    }
  });

  if (!menu) {
    throw new MenuDomainError("Menu is not available.", 404);
  }

  return menu;
};

const menuHasVisibleItems = (menu: MenuRecord | null) =>
  Boolean(
    menu?.categories.some(
      (category) => category.is_visible && category.items.some((item) => item.is_visible)
    )
  );

const getOrganizationMenuAvailabilityRecord = (organizationId: string, db: DomainDb) =>
  db.organization.findFirst({
    select: {
      id: true,
      menu: {
        select: {
          categories: {
            select: {
              id: true
            },
            take: 1,
            where: {
              is_visible: true,
              items: {
                some: {
                  is_visible: true
                }
              }
            }
          }
        }
      },
      module_settings: {
        select: {
          enabled: true
        },
        where: {
          module: "MENU"
        }
      },
      subscription: true
    },
    where: {
      id: organizationId,
      status: "ACTIVE"
    }
  });

const isMenuGuestAvailable = (
  organization: Awaited<ReturnType<typeof getOrganizationMenuAvailabilityRecord>>
) =>
  Boolean(
    organization &&
    isOrganizationSubscriptionActive(organization.subscription) &&
    organization.module_settings[0]?.enabled === true &&
    organization.menu?.categories.length
  );

export const getOrganizationGuestMenuSummary = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
): Promise<GuestMenuSummary> => {
  if (!isMenuModuleRolloutEnabled()) {
    return { available: false };
  }

  const organization = await getOrganizationMenuAvailabilityRecord(organizationId, db);

  return {
    available: isMenuGuestAvailable(organization)
  };
};

export const getOrganizationMenuAdminSummary = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
): Promise<AdminMenuSummaryPayload> => {
  assertMenuModuleRolloutEnabled();
  const organization = await getOrganizationMenuAvailabilityRecord(organizationId, db);

  if (!organization) {
    throw new MenuDomainError("Organization is not available.", 404);
  }

  return {
    guestAvailable: isMenuGuestAvailable(organization),
    moduleEnabled: organization.module_settings[0]?.enabled === true,
    organizationId: organization.id
  };
};

export const getOrganizationMenuAdmin = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
): Promise<AdminMenuPayload> => {
  await assertActiveOrganization(organizationId, db);
  const [organization, menu] = await Promise.all([
    db.organization.findUnique({
      select: {
        module_settings: {
          select: {
            enabled: true
          },
          where: {
            module: "MENU"
          }
        },
        subscription: true
      },
      where: {
        id: organizationId
      }
    }),
    getMenuRecord(organizationId, db)
  ]);
  const moduleEnabled = organization?.module_settings[0]?.enabled === true;

  return {
    guestAvailable: Boolean(
      moduleEnabled &&
      isOrganizationSubscriptionActive(organization?.subscription) &&
      menuHasVisibleItems(menu)
    ),
    menu: menu ? toMenuPayload(menu, organizationId) : null,
    moduleEnabled,
    organizationId
  };
};

export const createOrganizationMenu = async (
  {
    input,
    organizationId
  }: {
    input: CreateMenuInput;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const organization = await assertActiveOrganization(organizationId, db);
  const existing = await db.menu.findUnique({
    select: { id: true },
    where: { organization_id: organizationId }
  });

  if (!existing) {
    try {
      await db.menu.create({
        data: {
          content_locale: input.contentLocale ?? fromPrismaLocale(organization.locale),
          currency_code: input.currencyCode,
          organization_id: organizationId
        }
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }
  }

  return getOrganizationMenuAdmin(organizationId, db);
};

export const updateOrganizationMenu = async (
  {
    input,
    organizationId
  }: {
    input: UpdateMenuInput;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const menu = await assertMenu(organizationId, db);

  await runMenuTransaction(db, async (tx) => {
    await lockMenuForMutation(menu.id, tx);

    if (input.currencyCode) {
      const current = await tx.menu.findUnique({
        select: { currency_code: true },
        where: { id: menu.id }
      });

      if (current?.currency_code !== input.currencyCode) {
        const item = await tx.menuItem.findFirst({
          select: { id: true },
          where: { category: { menu_id: menu.id } }
        });

        if (item) {
          throw new MenuDomainError("Menu currency cannot be changed while items exist.", 409);
        }
      }
    }

    await tx.menu.update({
      data: {
        ...(input.contentLocale ? { content_locale: input.contentLocale } : {}),
        ...(input.currencyCode ? { currency_code: input.currencyCode } : {}),
        revision: { increment: 1 }
      },
      where: { id: menu.id }
    });
  });

  return getOrganizationMenuAdmin(organizationId, db);
};

export const updateOrganizationMenuEnabled = async (
  {
    enabled,
    organizationId
  }: {
    enabled: boolean;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  await db.organizationModuleSetting.upsert({
    create: {
      enabled,
      module: "MENU",
      organization_id: organizationId
    },
    update: { enabled },
    where: {
      organization_id_module: {
        module: "MENU",
        organization_id: organizationId
      }
    }
  });

  return getOrganizationMenuAdmin(organizationId, db);
};

const bumpMenuRevision = (menuId: string, db: Prisma.TransactionClient) =>
  db.menu.update({
    data: { revision: { increment: 1 } },
    select: { id: true },
    where: { id: menuId }
  });

export const createOrganizationMenuCategory = async (
  {
    input,
    organizationId
  }: {
    input: CreateMenuCategoryInput;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const menu = await assertMenu(organizationId, db);
  const existing = await db.menuCategory.findFirst({
    select: { id: true },
    where: {
      creation_client_request_id: input.clientRequestId,
      menu_id: menu.id
    }
  });

  if (!existing) {
    try {
      await runMenuTransaction(db, async (tx) => {
        await lockMenuForMutation(menu.id, tx);
        const concurrentExisting = await tx.menuCategory.findFirst({
          select: { id: true },
          where: {
            creation_client_request_id: input.clientRequestId,
            menu_id: menu.id
          }
        });

        if (concurrentExisting) return;

        const categoryCount = await tx.menuCategory.count({
          where: { menu_id: menu.id }
        });

        if (categoryCount >= MENU_CATEGORY_LIMIT) {
          throw new MenuDomainError(
            `A menu can contain at most ${MENU_CATEGORY_LIMIT} categories.`,
            409
          );
        }

        await tx.menuCategory.create({
          data: {
            creation_client_request_id: input.clientRequestId,
            is_visible: input.isVisible,
            menu_id: menu.id,
            name: input.name,
            sort_order: input.sortOrder
          }
        });
        await bumpMenuRevision(menu.id, tx);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new MenuDomainError("Menu category request already belongs to another menu.", 409);
      }

      throw error;
    }
  }

  return getOrganizationMenuAdmin(organizationId, db);
};

const getOrganizationCategory = async (
  organizationId: string,
  categoryId: string,
  db: DomainDb
) => {
  const category = await db.menuCategory.findFirst({
    select: {
      id: true,
      menu_id: true
    },
    where: {
      id: categoryId,
      menu: { organization_id: organizationId }
    }
  });

  if (!category) {
    throw new MenuDomainError("Menu category is not available.", 404);
  }

  return category;
};

export const updateOrganizationMenuCategory = async (
  {
    categoryId,
    input,
    organizationId
  }: {
    categoryId: string;
    input: UpdateMenuCategoryInput;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const category = await getOrganizationCategory(organizationId, categoryId, db);

  await runMenuTransaction(db, async (tx) => {
    await lockMenuForMutation(category.menu_id, tx);
    const currentCategory = await tx.menuCategory.findFirst({
      select: { id: true },
      where: {
        id: category.id,
        menu_id: category.menu_id
      }
    });

    if (!currentCategory) {
      throw new MenuDomainError("Menu category is not available.", 404);
    }

    await tx.menuCategory.update({
      data: {
        ...(input.isVisible !== undefined ? { is_visible: input.isVisible } : {}),
        ...(input.name !== undefined ? { name: input.name } : {})
      },
      where: { id: currentCategory.id }
    });
    await bumpMenuRevision(category.menu_id, tx);
  });

  return getOrganizationMenuAdmin(organizationId, db);
};

export const reorderOrganizationMenuCategories = async (
  {
    input,
    organizationId
  }: {
    input: ReorderMenuEntitiesInput;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const menu = await assertMenu(organizationId, db);

  await runMenuTransaction(db, async (tx) => {
    await lockMenuForMutation(menu.id, tx);
    const categories = await tx.menuCategory.findMany({
      select: { id: true },
      where: { menu_id: menu.id }
    });
    const actualIds = new Set(categories.map((category) => category.id));

    if (
      actualIds.size !== input.orderedIds.length ||
      input.orderedIds.some((categoryId) => !actualIds.has(categoryId))
    ) {
      throw new MenuDomainError("Category reorder must contain every category in this menu.", 409);
    }

    await bulkUpdateSortOrder(
      { entity: "category", orderedIds: input.orderedIds, parentId: menu.id },
      tx
    );
    await bumpMenuRevision(menu.id, tx);
  });

  return getOrganizationMenuAdmin(organizationId, db);
};

const deleteClaimedDetachedPhoto = async (
  assetId: string,
  organizationId: string,
  db: DomainDb
) => {
  try {
    const asset = await db.mediaAsset.findFirst({
      select: { bucket: true, storage_key: true },
      where: {
        id: assetId,
        kind: "MENU_ITEM_PHOTO",
        menu_item_photo: { is: null },
        owner_id: organizationId,
        owner_type: "ORGANIZATION",
        status: "DELETED"
      }
    });

    if (!asset) return false;

    if (asset.bucket === LOCAL_MEDIA_BUCKET) {
      await deleteLocalMediaObject(asset.storage_key);
    } else {
      await deleteR2Object(asset.storage_key, asset.bucket);
    }

    const deleted = await db.mediaAsset.deleteMany({
      where: {
        id: assetId,
        kind: "MENU_ITEM_PHOTO",
        menu_item_photo: { is: null },
        owner_id: organizationId,
        owner_type: "ORGANIZATION",
        status: "DELETED"
      }
    });

    return deleted.count === 1;
  } catch (error) {
    console.warn("Detached menu photo cleanup failed", {
      assetId,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const claimAndDeleteDetachedPhoto = async (
  assetId: string,
  organizationId: string,
  db: DomainDb
) => {
  const claimed = await db.mediaAsset.updateMany({
    data: { status: "DELETED", updated_at: new Date() },
    where: {
      id: assetId,
      kind: "MENU_ITEM_PHOTO",
      menu_item_photo: { is: null },
      owner_id: organizationId,
      owner_type: "ORGANIZATION",
      status: "READY"
    }
  });

  if (claimed.count !== 1) return false;

  return deleteClaimedDetachedPhoto(assetId, organizationId, db);
};

const recoverAndDeleteStaleClaimedPhoto = async (
  assetId: string,
  organizationId: string,
  staleBefore: Date,
  now: Date,
  db: DomainDb
) => {
  const recoveredClaim = await db.mediaAsset.updateMany({
    data: { updated_at: now },
    where: {
      id: assetId,
      kind: "MENU_ITEM_PHOTO",
      menu_item_photo: { is: null },
      owner_id: organizationId,
      owner_type: "ORGANIZATION",
      status: "DELETED",
      updated_at: { lt: staleBefore }
    }
  });

  if (recoveredClaim.count !== 1) return false;

  return deleteClaimedDetachedPhoto(assetId, organizationId, db);
};

const MENU_PHOTO_CLEANUP_CONCURRENCY = 8;

const cleanupDetachedPhotos = async (
  assetIds: Array<null | string>,
  organizationId: string,
  db: DomainDb
) => {
  const uniqueIds = [...new Set(assetIds.filter((id): id is string => Boolean(id)))];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < uniqueIds.length) {
      const assetId = uniqueIds[nextIndex++];

      if (!assetId) continue;

      try {
        await claimAndDeleteDetachedPhoto(assetId, organizationId, db);
      } catch (error) {
        console.warn("Detached menu photo cleanup attempt failed", {
          assetId,
          error: error instanceof Error ? error.message : String(error),
          organizationId
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MENU_PHOTO_CLEANUP_CONCURRENCY, uniqueIds.length) }, () =>
      worker()
    )
  );
};

const cleanupClaimedPhotos = async (
  assetIds: Array<null | string>,
  organizationId: string,
  db: DomainDb
) => {
  const uniqueIds = [...new Set(assetIds.filter((id): id is string => Boolean(id)))];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < uniqueIds.length) {
      const assetId = uniqueIds[nextIndex++];

      if (!assetId) continue;

      try {
        await deleteClaimedDetachedPhoto(assetId, organizationId, db);
      } catch (error) {
        console.warn("Claimed menu photo cleanup attempt failed", {
          assetId,
          error: error instanceof Error ? error.message : String(error),
          organizationId
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MENU_PHOTO_CLEANUP_CONCURRENCY, uniqueIds.length) }, () =>
      worker()
    )
  );
};

const scheduleClaimedPhotoCleanup = (
  assetIds: Array<null | string>,
  organizationId: string,
  db: DomainDb
) => {
  void cleanupClaimedPhotos(assetIds, organizationId, db).catch((error) => {
    console.warn("Scheduled claimed menu photo cleanup failed", {
      error: error instanceof Error ? error.message : String(error),
      organizationId
    });
  });
};

const cleanupDetachedPhotosAfterFailedMutation = async (
  assetIds: Array<null | string>,
  organizationId: string,
  db: DomainDb
) => {
  try {
    await cleanupDetachedPhotos(assetIds, organizationId, db);
  } catch (error) {
    console.warn("Failed menu mutation photo cleanup failed", {
      assetIds: assetIds.filter(Boolean),
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const deleteDetachedOrganizationMenuPhoto = async (
  {
    mediaAssetId,
    organizationId
  }: {
    mediaAssetId: string;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
): Promise<DeleteDetachedMenuPhotoPayload> => {
  await assertActiveOrganization(organizationId, db);
  const asset = await db.mediaAsset.findFirst({
    select: {
      id: true,
      menu_item_photo: {
        select: { id: true }
      }
    },
    where: {
      id: mediaAssetId,
      kind: "MENU_ITEM_PHOTO",
      owner_id: organizationId,
      owner_type: "ORGANIZATION"
    }
  });

  if (!asset) {
    throw new MenuDomainError("Menu item photo is not available.", 404);
  }

  if (asset.menu_item_photo) {
    throw new MenuDomainError("An attached menu item photo cannot be deleted.", 409);
  }

  if (!(await claimAndDeleteDetachedPhoto(asset.id, organizationId, db))) {
    throw new MenuDomainError("Menu item photo could not be deleted.", 409);
  }

  return {
    deleted: true,
    mediaAssetId: asset.id,
    organizationId
  };
};

const DETACHED_MENU_PHOTO_GRACE_MS = 24 * 60 * 60 * 1000;
const DETACHED_MENU_PHOTO_SWEEP_LIMIT = 10;

export const cleanupStaleDetachedOrganizationMenuPhotos = async (
  {
    now = new Date(),
    organizationId
  }: {
    now?: Date;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const staleBefore = new Date(now.getTime() - DETACHED_MENU_PHOTO_GRACE_MS);
  const [readyAssets, staleClaimedAssets] = await Promise.all([
    db.mediaAsset.findMany({
      orderBy: { created_at: "asc" },
      select: { id: true },
      take: DETACHED_MENU_PHOTO_SWEEP_LIMIT,
      where: {
        created_at: { lt: staleBefore },
        kind: "MENU_ITEM_PHOTO",
        menu_item_photo: { is: null },
        owner_id: organizationId,
        owner_type: "ORGANIZATION",
        status: "READY"
      }
    }),
    db.mediaAsset.findMany({
      orderBy: { updated_at: "asc" },
      select: { id: true },
      take: DETACHED_MENU_PHOTO_SWEEP_LIMIT,
      where: {
        kind: "MENU_ITEM_PHOTO",
        menu_item_photo: { is: null },
        owner_id: organizationId,
        owner_type: "ORGANIZATION",
        status: "DELETED",
        updated_at: { lt: staleBefore }
      }
    })
  ]);
  const deleted = await Promise.all([
    ...readyAssets.map((asset) => claimAndDeleteDetachedPhoto(asset.id, organizationId, db)),
    ...staleClaimedAssets.map((asset) =>
      recoverAndDeleteStaleClaimedPhoto(asset.id, organizationId, staleBefore, now, db)
    )
  ]);

  return deleted.filter(Boolean).length;
};

export const deleteOrganizationMenuCategory = async (
  {
    categoryId,
    organizationId
  }: {
    categoryId: string;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const category = await getOrganizationCategory(organizationId, categoryId, db);
  const detachedPhotoIds = await runMenuTransaction(db, async (tx) => {
    await lockMenuForMutation(category.menu_id, tx);
    const currentCategory = await tx.menuCategory.findFirst({
      select: { id: true },
      where: {
        id: category.id,
        menu_id: category.menu_id
      }
    });

    if (!currentCategory) {
      throw new MenuDomainError("Menu category is not available.", 404);
    }

    const photos = await tx.menuItem.findMany({
      select: { photo_media_asset_id: true },
      where: { category_id: currentCategory.id }
    });
    const photoIds = photos
      .map((photo) => photo.photo_media_asset_id)
      .filter((id): id is string => Boolean(id));

    if (photoIds.length > 0) {
      await tx.mediaAsset.updateMany({
        data: {
          status: "DELETED",
          updated_at: new Date()
        },
        where: {
          id: { in: photoIds },
          kind: "MENU_ITEM_PHOTO",
          owner_id: organizationId,
          owner_type: "ORGANIZATION",
          status: "READY"
        }
      });
    }

    await tx.menuCategory.delete({ where: { id: currentCategory.id } });
    await bumpMenuRevision(category.menu_id, tx);
    return photoIds;
  });
  scheduleClaimedPhotoCleanup(detachedPhotoIds, organizationId, db);

  return getOrganizationMenuAdmin(organizationId, db);
};

const assertMenuPhoto = async (
  photoMediaAssetId: null | string,
  organizationId: string,
  db: DomainDb,
  currentItemId?: string
) => {
  if (!photoMediaAssetId) return;

  const asset = await db.mediaAsset.findFirst({
    select: {
      id: true,
      menu_item_photo: {
        select: { id: true }
      }
    },
    where: {
      id: photoMediaAssetId,
      kind: "MENU_ITEM_PHOTO",
      owner_id: organizationId,
      owner_type: "ORGANIZATION",
      status: "READY"
    }
  });

  if (!asset) {
    throw new MenuDomainError("Menu item photo is not available.", 400);
  }

  if (asset.menu_item_photo && asset.menu_item_photo.id !== currentItemId) {
    throw new MenuDomainError("Menu item photo is already in use.", 409);
  }
};

const lockAndAssertMenuPhotoForAssociation = async (
  photoMediaAssetId: null | string,
  organizationId: string,
  db: Prisma.TransactionClient,
  currentItemId?: string
) => {
  if (!photoMediaAssetId) return;

  await db.$queryRaw(
    Prisma.sql`SELECT "id" FROM "MediaAsset" WHERE "id" = ${photoMediaAssetId} FOR UPDATE`
  );
  await assertMenuPhoto(photoMediaAssetId, organizationId, db, currentItemId);
};

export const createOrganizationMenuItem = async (
  {
    categoryId,
    input,
    organizationId
  }: {
    categoryId: string;
    input: CreateMenuItemInput;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const category = await getOrganizationCategory(organizationId, categoryId, db);
  const existing = await db.menuItem.findFirst({
    select: { id: true },
    where: {
      creation_client_request_id: input.clientRequestId,
      category: { menu_id: category.menu_id }
    }
  });

  if (existing) {
    await cleanupDetachedPhotosAfterFailedMutation([input.photoMediaAssetId], organizationId, db);
  } else {
    await assertMenuPhoto(input.photoMediaAssetId, organizationId, db);

    try {
      const created = await runMenuTransaction(db, async (tx) => {
        await lockMenuForMutation(category.menu_id, tx);
        const currentCategory = await tx.menuCategory.findFirst({
          select: { id: true },
          where: {
            id: category.id,
            menu_id: category.menu_id
          }
        });

        if (!currentCategory) {
          throw new MenuDomainError("Menu category is not available.", 404);
        }

        const concurrentExisting = await tx.menuItem.findFirst({
          select: { id: true },
          where: {
            creation_client_request_id: input.clientRequestId,
            category: { menu_id: category.menu_id }
          }
        });

        if (concurrentExisting) return false;

        await lockAndAssertMenuPhotoForAssociation(input.photoMediaAssetId, organizationId, tx);

        const itemCount = await tx.menuItem.count({
          where: { category_id: currentCategory.id }
        });

        if (itemCount >= MENU_ITEMS_PER_CATEGORY_LIMIT) {
          throw new MenuDomainError(
            `A menu category can contain at most ${MENU_ITEMS_PER_CATEGORY_LIMIT} items.`,
            409
          );
        }

        const totalItemCount = await tx.menuItem.count({
          where: { category: { menu_id: category.menu_id } }
        });

        if (totalItemCount >= MENU_TOTAL_ITEM_LIMIT) {
          throw new MenuDomainError(
            `A menu can contain at most ${MENU_TOTAL_ITEM_LIMIT} items.`,
            409
          );
        }

        await tx.menuItem.create({
          data: {
            allergen_codes: input.allergenCodes,
            category_id: currentCategory.id,
            creation_client_request_id: input.clientRequestId,
            description: input.description,
            dietary_tag_codes: input.dietaryTagCodes,
            is_available: input.isAvailable,
            is_visible: input.isVisible,
            marketing_tag_codes: input.marketingTagCodes,
            name: input.name,
            photo_media_asset_id: input.photoMediaAssetId,
            portion_label: input.portionLabel,
            price_minor: input.priceMinor,
            sort_order: input.sortOrder,
            spice_level: input.spiceLevel
          }
        });
        await bumpMenuRevision(category.menu_id, tx);
        return true;
      });

      if (!created) {
        await cleanupDetachedPhotosAfterFailedMutation(
          [input.photoMediaAssetId],
          organizationId,
          db
        );
      }
    } catch (error) {
      await cleanupDetachedPhotosAfterFailedMutation([input.photoMediaAssetId], organizationId, db);

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new MenuDomainError("Menu item request or photo is already in use.", 409);
      }

      throw error;
    }
  }

  return getOrganizationMenuAdmin(organizationId, db);
};

const getOrganizationItem = async (organizationId: string, itemId: string, db: DomainDb) => {
  const item = await db.menuItem.findFirst({
    select: {
      category_id: true,
      category: {
        select: { menu_id: true }
      },
      id: true,
      photo_media_asset_id: true
    },
    where: {
      id: itemId,
      category: { menu: { organization_id: organizationId } }
    }
  });

  if (!item) {
    throw new MenuDomainError("Menu item is not available.", 404);
  }

  return item;
};

export const updateOrganizationMenuItem = async (
  {
    input,
    itemId,
    organizationId
  }: {
    input: UpdateMenuItemInput;
    itemId: string;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const item = await getOrganizationItem(organizationId, itemId, db);

  if (input.photoMediaAssetId !== undefined) {
    await assertMenuPhoto(input.photoMediaAssetId, organizationId, db, item.id);
  }

  let detachedPhotoId: null | string = null;

  try {
    detachedPhotoId = await runMenuTransaction(db, async (tx) => {
      await lockMenuForMutation(item.category.menu_id, tx);
      const currentItem = await tx.menuItem.findFirst({
        select: {
          id: true,
          photo_media_asset_id: true
        },
        where: {
          id: item.id,
          category: { menu_id: item.category.menu_id }
        }
      });

      if (!currentItem) {
        throw new MenuDomainError("Menu item is not available.", 404);
      }

      if (input.photoMediaAssetId !== undefined) {
        await lockAndAssertMenuPhotoForAssociation(
          input.photoMediaAssetId,
          organizationId,
          tx,
          currentItem.id
        );
      }

      await tx.menuItem.update({
        data: {
          ...(input.allergenCodes !== undefined ? { allergen_codes: input.allergenCodes } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.dietaryTagCodes !== undefined
            ? { dietary_tag_codes: input.dietaryTagCodes }
            : {}),
          ...(input.isAvailable !== undefined ? { is_available: input.isAvailable } : {}),
          ...(input.isVisible !== undefined ? { is_visible: input.isVisible } : {}),
          ...(input.marketingTagCodes !== undefined
            ? { marketing_tag_codes: input.marketingTagCodes }
            : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.photoMediaAssetId !== undefined
            ? { photo_media_asset_id: input.photoMediaAssetId }
            : {}),
          ...(input.portionLabel !== undefined ? { portion_label: input.portionLabel } : {}),
          ...(input.priceMinor !== undefined ? { price_minor: input.priceMinor } : {}),
          ...(input.spiceLevel !== undefined ? { spice_level: input.spiceLevel } : {})
        },
        where: { id: currentItem.id }
      });
      await bumpMenuRevision(item.category.menu_id, tx);
      return input.photoMediaAssetId !== undefined &&
        input.photoMediaAssetId !== currentItem.photo_media_asset_id
        ? currentItem.photo_media_asset_id
        : null;
    });
  } catch (error) {
    await cleanupDetachedPhotosAfterFailedMutation(
      [input.photoMediaAssetId ?? null],
      organizationId,
      db
    );

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new MenuDomainError("Menu item photo is already in use.", 409);
    }

    throw error;
  }

  await cleanupDetachedPhotos([detachedPhotoId], organizationId, db);

  return getOrganizationMenuAdmin(organizationId, db);
};

export const reorderOrganizationMenuItems = async (
  {
    categoryId,
    input,
    organizationId
  }: {
    categoryId: string;
    input: ReorderMenuEntitiesInput;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const category = await getOrganizationCategory(organizationId, categoryId, db);

  await runMenuTransaction(db, async (tx) => {
    await lockMenuForMutation(category.menu_id, tx);
    const currentCategory = await tx.menuCategory.findFirst({
      select: { id: true },
      where: {
        id: category.id,
        menu_id: category.menu_id
      }
    });

    if (!currentCategory) {
      throw new MenuDomainError("Menu category is not available.", 404);
    }

    const items = await tx.menuItem.findMany({
      select: { id: true },
      where: { category_id: currentCategory.id }
    });
    const actualIds = new Set(items.map((item) => item.id));

    if (
      actualIds.size !== input.orderedIds.length ||
      input.orderedIds.some((itemId) => !actualIds.has(itemId))
    ) {
      throw new MenuDomainError("Item reorder must contain every item in this category.", 409);
    }

    await bulkUpdateSortOrder(
      { entity: "item", orderedIds: input.orderedIds, parentId: currentCategory.id },
      tx
    );
    await bumpMenuRevision(category.menu_id, tx);
  });

  return getOrganizationMenuAdmin(organizationId, db);
};

export const deleteOrganizationMenuItem = async (
  {
    itemId,
    organizationId
  }: {
    itemId: string;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  await assertActiveOrganization(organizationId, db);
  const item = await getOrganizationItem(organizationId, itemId, db);

  const detachedPhotoId = await runMenuTransaction(db, async (tx) => {
    await lockMenuForMutation(item.category.menu_id, tx);
    const currentItem = await tx.menuItem.findFirst({
      select: {
        id: true,
        photo_media_asset_id: true
      },
      where: {
        id: item.id,
        category: { menu_id: item.category.menu_id }
      }
    });

    if (!currentItem) {
      throw new MenuDomainError("Menu item is not available.", 404);
    }

    await tx.menuItem.delete({ where: { id: currentItem.id } });
    await bumpMenuRevision(item.category.menu_id, tx);
    return currentItem.photo_media_asset_id;
  });
  await cleanupDetachedPhotos([detachedPhotoId], organizationId, db);

  return getOrganizationMenuAdmin(organizationId, db);
};

export const getGuestMenuByStartParam = async (
  {
    startParam
  }: {
    startParam: string;
  },
  db: DomainDb = getDomainDb()
): Promise<GuestMenuPayload> => {
  assertMenuModuleRolloutEnabled();
  const guestEntryPayload = parseGuestEntryStartParam(startParam);
  const organization = await db.organization.findFirst({
    select: { id: true },
    where: {
      OR: [{ id: guestEntryPayload.organizationRef }, { slug: guestEntryPayload.organizationRef }],
      status: "ACTIVE"
    }
  });

  if (!organization) {
    throw new MenuDomainError("Organization is not available.", 404);
  }

  if (guestEntryPayload.contextCode) {
    const context = await getOrganizationGuestContextByCode(
      {
        code: guestEntryPayload.contextCode,
        organizationId: organization.id
      },
      db
    );

    if (!context) {
      throw new MenuDomainError("Guest entry context is not available.", 404);
    }
  }

  const organizationWithMenu = await db.organization.findFirst({
    select: {
      id: true,
      menu: { include: guestMenuInclude },
      module_settings: {
        select: { enabled: true },
        where: { module: "MENU" }
      },
      subscription: true
    },
    where: {
      id: organization.id,
      status: "ACTIVE"
    }
  });

  if (!organizationWithMenu) {
    throw new MenuDomainError("Menu is not available.", 404);
  }

  if (
    !isOrganizationSubscriptionActive(organizationWithMenu.subscription) ||
    organizationWithMenu.module_settings[0]?.enabled !== true ||
    !menuHasVisibleItems(organizationWithMenu.menu)
  ) {
    throw new MenuDomainError("Menu is not available.", 404);
  }

  return {
    menu: toMenuPayload(organizationWithMenu.menu!, organization.id, { onlyVisible: true }),
    organizationId: organization.id
  };
};
