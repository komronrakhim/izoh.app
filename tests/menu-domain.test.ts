import { describe, expect, it, vi } from "vitest";

import {
  cleanupStaleDetachedOrganizationMenuPhotos,
  createOrganizationMenuCategory,
  createOrganizationMenuItem,
  deleteDetachedOrganizationMenuPhoto,
  deleteOrganizationMenuCategory,
  deleteOrganizationMenuItem,
  getGuestMenuByStartParam,
  getOrganizationGuestMenuSummary,
  getOrganizationMenuAdminSummary,
  reorderOrganizationMenuCategories,
  reorderOrganizationMenuItems,
  updateOrganizationMenu,
  updateOrganizationMenuCategory,
  updateOrganizationMenuItem
} from "~/server/domain/menu";

const activeSubscription = {
  cancel_at_period_end: false,
  current_period_ends_at: new Date("2099-01-01T00:00:00.000Z"),
  current_period_started_at: new Date("2026-01-01T00:00:00.000Z"),
  plan_code: "MONTHLY",
  source: "TELEGRAM_STARS",
  status: "ACTIVE",
  trial_ends_at: null,
  trial_started_at: null
};

const createMenuPhotoFindMock = ({ id, storageKey }: { id: string; storageKey: string }) =>
  vi.fn(async ({ select }: { select: Record<string, unknown> }) =>
    "bucket" in select
      ? { bucket: "local-dev", storage_key: storageKey }
      : { id, menu_item_photo: null }
  );

describe("menu domain", () => {
  it("fails closed in production until the rollout gate is explicitly enabled", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousRolloutFlag = process.env.MENU_MODULE_ROLLOUT_ENABLED;
    const findFirst = vi.fn();

    process.env.NODE_ENV = "production";
    delete process.env.MENU_MODULE_ROLLOUT_ENABLED;

    try {
      await expect(
        getOrganizationGuestMenuSummary("org_1", {
          organization: { findFirst }
        } as never)
      ).resolves.toEqual({ available: false });
      await expect(
        getOrganizationMenuAdminSummary("org_1", {
          organization: { findFirst }
        } as never)
      ).rejects.toMatchObject({ status: 404 });
      expect(findFirst).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;

      if (previousRolloutFlag === undefined) delete process.env.MENU_MODULE_ROLLOUT_ENABLED;
      else process.env.MENU_MODULE_ROLLOUT_ENABLED = previousRolloutFlag;
    }
  });

  it("requires active subscription, explicit module toggle, and visible content", async () => {
    const findFirst = vi.fn(async (_query: unknown) => ({
      menu: { categories: [{ id: "category_1" }] },
      module_settings: [{ enabled: true }],
      subscription: activeSubscription
    }));

    await expect(
      getOrganizationGuestMenuSummary("org_1", { organization: { findFirst } } as never)
    ).resolves.toEqual({ available: true });

    const query = findFirst.mock.calls[0]?.[0];

    expect(JSON.stringify(query)).toContain('"is_visible":true');
    expect(JSON.stringify(query)).not.toContain("is_available");
  });

  it("treats an absent module setting as disabled", async () => {
    await expect(
      getOrganizationGuestMenuSummary("org_1", {
        organization: {
          findFirst: async () => ({
            menu: { categories: [{ id: "category_1" }] },
            module_settings: [],
            subscription: activeSubscription
          })
        }
      } as never)
    ).resolves.toEqual({ available: false });
  });

  it("returns a tenant-scoped lightweight owner summary", async () => {
    const findFirst = vi.fn(async (_query: unknown) => ({
      id: "org_owner",
      menu: { categories: [{ id: "category_1" }] },
      module_settings: [{ enabled: true }],
      subscription: activeSubscription
    }));

    await expect(
      getOrganizationMenuAdminSummary("org_owner", {
        organization: { findFirst }
      } as never)
    ).resolves.toEqual({
      guestAvailable: true,
      moduleEnabled: true,
      organizationId: "org_owner"
    });

    const query = findFirst.mock.calls[0]?.[0] as {
      select: {
        menu: { select: { categories: { select: unknown; take: number } } };
      };
      where: unknown;
    };

    expect(query.where).toEqual({ id: "org_owner", status: "ACTIVE" });
    expect(query.select.menu.select.categories).toMatchObject({
      select: { id: true },
      take: 1
    });
  });

  it("locks the menu row before checking the currency invariant", async () => {
    const events: string[] = [];
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $queryRaw: async () => {
            events.push("lock");
          },
          menu: {
            findUnique: async () => {
              events.push("currency");
              return { currency_code: "USD" };
            },
            update: vi.fn()
          },
          menuItem: {
            findFirst: async () => {
              events.push("item-check");
              return { id: "item_1" };
            }
          }
        }),
      menu: {
        findUnique: async () => ({ id: "menu_1" })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" }),
        findUnique: async () => ({
          module_settings: [],
          subscription: activeSubscription
        })
      }
    } as never;

    await expect(
      updateOrganizationMenu(
        {
          input: { currencyCode: "EUR" },
          organizationId: "org_1"
        },
        db
      )
    ).rejects.toMatchObject({ status: 409 });

    expect(events).toEqual(["lock", "currency", "item-check"]);
  });

  it("enforces the category limit while holding the menu lock", async () => {
    const events: string[] = [];
    const categoryCreate = vi.fn();
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $queryRaw: async () => {
            events.push("lock");
          },
          menuCategory: {
            count: async () => {
              events.push("count");
              return 500;
            },
            create: categoryCreate,
            findFirst: async () => null
          }
        }),
      menu: {
        findUnique: async () => ({ id: "menu_1" })
      },
      menuCategory: {
        findFirst: async () => null
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      createOrganizationMenuCategory(
        {
          input: {
            clientRequestId: "category-limit-request",
            isVisible: true,
            name: "Overflow",
            sortOrder: 500
          },
          organizationId: "org_1"
        },
        db
      )
    ).rejects.toMatchObject({ status: 409 });

    expect(events).toEqual(["lock", "count"]);
    expect(categoryCreate).not.toHaveBeenCalled();
  });

  it("enforces the per-category item limit while holding the same menu lock", async () => {
    const events: string[] = [];
    const itemCreate = vi.fn();
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $queryRaw: async () => {
            events.push("lock");
          },
          menuCategory: {
            findFirst: async () => {
              events.push("category-read");
              return { id: "category_1" };
            }
          },
          menuItem: {
            count: async () => {
              events.push("count");
              return 500;
            },
            create: itemCreate,
            findFirst: async () => null
          }
        }),
      menuCategory: {
        findFirst: async () => ({ id: "category_1", menu_id: "menu_1" })
      },
      menuItem: {
        findFirst: async () => null
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      createOrganizationMenuItem(
        {
          categoryId: "category_1",
          input: {
            allergenCodes: [],
            clientRequestId: "item-limit-request",
            description: "",
            dietaryTagCodes: [],
            isAvailable: true,
            isVisible: true,
            marketingTagCodes: [],
            name: "Overflow",
            photoMediaAssetId: null,
            portionLabel: "",
            priceMinor: 100,
            sortOrder: 500,
            spiceLevel: 0
          },
          organizationId: "org_1"
        },
        db
      )
    ).rejects.toMatchObject({ status: 409 });

    expect(events).toEqual(["lock", "category-read", "count"]);
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it("enforces the total menu item limit while holding the same menu lock", async () => {
    const events: string[] = [];
    const itemCreate = vi.fn();
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $queryRaw: async () => {
            events.push("lock");
          },
          menuCategory: {
            findFirst: async () => {
              events.push("category-read");
              return { id: "category_1" };
            }
          },
          menuItem: {
            count: async ({ where }: { where: { category?: unknown; category_id?: string } }) => {
              events.push(where.category_id ? "category-count" : "menu-count");
              return where.category_id ? 1 : 500;
            },
            create: itemCreate,
            findFirst: async () => null
          }
        }),
      menuCategory: {
        findFirst: async () => ({ id: "category_1", menu_id: "menu_1" })
      },
      menuItem: {
        findFirst: async () => null
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      createOrganizationMenuItem(
        {
          categoryId: "category_1",
          input: {
            allergenCodes: [],
            clientRequestId: "total-item-limit-request",
            description: "",
            dietaryTagCodes: [],
            isAvailable: true,
            isVisible: true,
            marketingTagCodes: [],
            name: "Overflow",
            photoMediaAssetId: null,
            portionLabel: "",
            priceMinor: 100,
            sortOrder: 1,
            spiceLevel: 0
          },
          organizationId: "org_1"
        },
        db
      )
    ).rejects.toMatchObject({ status: 409 });

    expect(events).toEqual(["lock", "category-read", "category-count", "menu-count"]);
    expect(itemCreate).not.toHaveBeenCalled();
  });

  it("returns a clean not-found when a category is deleted before item creation locks the menu", async () => {
    const itemCount = vi.fn();
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $queryRaw: async () => undefined,
          menuCategory: { findFirst: async () => null },
          menuItem: { count: itemCount }
        }),
      menuCategory: {
        findFirst: async () => ({ id: "category_1", menu_id: "menu_1" })
      },
      menuItem: { findFirst: async () => null },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      createOrganizationMenuItem(
        {
          categoryId: "category_1",
          input: {
            allergenCodes: [],
            clientRequestId: "deleted-category-item-request",
            description: "",
            dietaryTagCodes: [],
            isAvailable: true,
            isVisible: true,
            marketingTagCodes: [],
            name: "Dish",
            photoMediaAssetId: null,
            portionLabel: "",
            priceMinor: 100,
            sortOrder: 0,
            spiceLevel: 0
          },
          organizationId: "org_1"
        },
        db
      )
    ).rejects.toMatchObject({ status: 404 });

    expect(itemCount).not.toHaveBeenCalled();
  });

  it("locks the menu before updating a category", async () => {
    const events: string[] = [];
    const storedMenu = {
      categories: [],
      content_locale: "en",
      currency_code: "USD",
      id: "menu_1",
      organization_id: "org_1",
      revision: 2
    };
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $queryRaw: async () => {
            events.push("menu-lock");
          },
          menu: { update: async () => ({ id: "menu_1" }) },
          menuCategory: {
            findFirst: async () => {
              events.push("category-read");
              return { id: "category_1" };
            },
            update: async () => {
              events.push("category-update");
            }
          }
        }),
      menu: {
        findUnique: async (query: { include?: unknown }) => (query.include ? storedMenu : null)
      },
      menuCategory: {
        findFirst: async () => ({ id: "category_1", menu_id: "menu_1" })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" }),
        findUnique: async () => ({ module_settings: [], subscription: activeSubscription })
      }
    } as never;

    await expect(
      updateOrganizationMenuCategory(
        {
          categoryId: "category_1",
          input: { name: "Updated" },
          organizationId: "org_1"
        },
        db
      )
    ).resolves.toMatchObject({ organizationId: "org_1" });

    expect(events).toEqual(["menu-lock", "category-read", "category-update"]);
  });

  it("keeps a sold-out visible item in the public menu", async () => {
    const findFirst = vi.fn(async (_query: unknown) => ({
      id: "org_1",
      menu: {
        categories: [
          {
            created_at: new Date("2026-01-01T00:00:00.000Z"),
            id: "category_1",
            is_visible: true,
            items: [
              {
                allergen_codes: [],
                category_id: "category_1",
                created_at: new Date("2026-01-01T00:00:00.000Z"),
                description: "",
                dietary_tag_codes: [],
                id: "item_1",
                is_available: false,
                is_visible: true,
                marketing_tag_codes: [],
                name: "Sold out dish",
                photo_media_asset: null,
                photo_media_asset_id: null,
                portion_label: "",
                price_minor: 2500,
                sort_order: 0,
                spice_level: 0,
                updated_at: new Date("2026-01-01T00:00:00.000Z")
              },
              {
                allergen_codes: [],
                category_id: "category_1",
                created_at: new Date("2026-01-01T00:00:00.000Z"),
                description: "",
                dietary_tag_codes: [],
                id: "hidden_item",
                is_available: true,
                is_visible: false,
                marketing_tag_codes: [],
                name: "Hidden",
                photo_media_asset: null,
                photo_media_asset_id: null,
                portion_label: "",
                price_minor: 100,
                sort_order: 1,
                spice_level: 0,
                updated_at: new Date("2026-01-01T00:00:00.000Z")
              }
            ],
            menu_id: "menu_1",
            name: "Main",
            sort_order: 0,
            updated_at: new Date("2026-01-01T00:00:00.000Z")
          },
          {
            created_at: new Date("2026-01-01T00:00:00.000Z"),
            id: "empty_category",
            is_visible: true,
            items: [],
            menu_id: "menu_1",
            name: "Empty",
            sort_order: 1,
            updated_at: new Date("2026-01-01T00:00:00.000Z")
          }
        ],
        content_locale: "en",
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        currency_code: "USD",
        id: "menu_1",
        organization_id: "org_1",
        revision: 1,
        updated_at: new Date("2026-01-01T00:00:00.000Z")
      },
      module_settings: [{ enabled: true }],
      subscription: activeSubscription
    }));
    const payload = await getGuestMenuByStartParam({ startParam: "coffee-place" }, {
      organization: {
        findFirst
      }
    } as never);

    expect(payload.menu.categories[0]?.items[0]).toMatchObject({
      id: "item_1",
      isAvailable: false,
      isVisible: true
    });
    expect(payload.menu.categories.map((category) => category.id)).toEqual(["category_1"]);
    expect(payload.menu.categories[0]?.items.map((item) => item.id)).toEqual(["item_1"]);

    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      select: { id: true }
    });

    const query = findFirst.mock.calls[1]?.[0] as {
      select: {
        menu: {
          include: {
            categories: {
              include: { items: { where: unknown } };
              where: unknown;
            };
          };
        };
      };
    };

    expect(query.select.menu.include.categories.where).toEqual({
      is_visible: true,
      items: { some: { is_visible: true } }
    });
    expect(query.select.menu.include.categories.include.items.where).toEqual({
      is_visible: true
    });
  });

  it("validates a guest context before loading the full visible menu", async () => {
    const events: string[] = [];
    const organizationFind = vi.fn(async (query: { select: { menu?: unknown } }) => {
      events.push(query.select.menu ? "menu" : "organization");
      return { id: "org_1" };
    });
    const contextFind = vi.fn(async () => {
      events.push("context");
      return null;
    });

    await expect(
      getGuestMenuByStartParam({ startParam: "coffee-place__abcd" }, {
        organization: { findFirst: organizationFind },
        organizationGuestContext: { findFirst: contextFind }
      } as never)
    ).rejects.toMatchObject({ status: 404 });

    expect(events).toEqual(["organization", "context"]);
    expect(organizationFind).toHaveBeenCalledTimes(1);
    expect(contextFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: "abcd", organization_id: "org_1" }
      })
    );
  });

  it("reorders the complete category set atomically and increments revision once", async () => {
    const events: string[] = [];
    const bulkUpdate = vi.fn(async () => 2);
    const revisionUpdate = vi.fn(async () => ({ id: "menu_1" }));
    const storedMenu = {
      categories: [],
      content_locale: "en",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      currency_code: "USD",
      id: "menu_1",
      organization_id: "org_1",
      revision: 2,
      updated_at: new Date("2026-01-01T00:00:00.000Z")
    };
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $executeRaw: async () => {
            events.push("bulk-update");
            return bulkUpdate();
          },
          $queryRaw: async () => {
            events.push("lock");
          },
          menu: { update: revisionUpdate },
          menuCategory: {
            findMany: async () => {
              events.push("read");
              return [{ id: "category_1" }, { id: "category_2" }];
            }
          }
        }),
      menu: {
        findUnique: async (query: { include?: unknown }) =>
          query.include ? storedMenu : { id: "menu_1" }
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" }),
        findUnique: async () => ({ module_settings: [], subscription: activeSubscription })
      }
    } as never;

    await expect(
      reorderOrganizationMenuCategories(
        {
          input: { orderedIds: ["category_2", "category_1"] },
          organizationId: "org_1"
        },
        db
      )
    ).resolves.toMatchObject({ organizationId: "org_1" });

    expect(events).toEqual(["lock", "read", "bulk-update"]);
    expect(bulkUpdate).toHaveBeenCalledTimes(1);
    expect(revisionUpdate).toHaveBeenCalledTimes(1);
  });

  it("locks the menu before validating and reordering the complete item set", async () => {
    const events: string[] = [];
    const bulkUpdate = vi.fn(async () => 2);
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $executeRaw: async () => {
            events.push("bulk-update");
            return bulkUpdate();
          },
          $queryRaw: async () => {
            events.push("lock");
          },
          menu: { update: async () => ({ id: "menu_1" }) },
          menuCategory: {
            findFirst: async () => {
              events.push("category-read");
              return { id: "category_1" };
            }
          },
          menuItem: {
            findMany: async () => {
              events.push("read");
              return [{ id: "item_1" }, { id: "item_2" }];
            }
          }
        }),
      menuCategory: {
        findFirst: async () => ({ id: "category_1", menu_id: "menu_1" })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" }),
        findUnique: async () => ({
          module_settings: [],
          subscription: activeSubscription
        })
      },
      menu: {
        findUnique: async (query: { include?: unknown }) =>
          query.include
            ? {
                categories: [],
                content_locale: "en",
                currency_code: "USD",
                id: "menu_1",
                organization_id: "org_1",
                revision: 2
              }
            : { id: "menu_1" }
      }
    } as never;

    await expect(
      reorderOrganizationMenuItems(
        {
          categoryId: "category_1",
          input: { orderedIds: ["item_2", "item_1"] },
          organizationId: "org_1"
        },
        db
      )
    ).resolves.toMatchObject({ organizationId: "org_1" });

    expect(events).toEqual(["lock", "category-read", "read", "bulk-update"]);
    expect(bulkUpdate).toHaveBeenCalledTimes(1);
  });

  it("returns a clean not-found when a category is deleted before item reorder locks the menu", async () => {
    const itemRead = vi.fn();
    const bulkUpdate = vi.fn();
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $executeRaw: bulkUpdate,
          $queryRaw: async () => undefined,
          menuCategory: { findFirst: async () => null },
          menuItem: { findMany: itemRead }
        }),
      menuCategory: {
        findFirst: async () => ({ id: "category_1", menu_id: "menu_1" })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      reorderOrganizationMenuItems(
        {
          categoryId: "category_1",
          input: { orderedIds: ["item_1"] },
          organizationId: "org_1"
        },
        db
      )
    ).rejects.toMatchObject({ status: 404 });

    expect(itemRead).not.toHaveBeenCalled();
    expect(bulkUpdate).not.toHaveBeenCalled();
  });

  it("locks the menu before re-reading an item and cleans the actual replaced photo", async () => {
    const events: string[] = [];
    const cleanupClaims: string[] = [];
    let lockCount = 0;
    const storedMenu = {
      categories: [],
      content_locale: "en",
      currency_code: "USD",
      id: "menu_1",
      organization_id: "org_1",
      revision: 2
    };
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $queryRaw: async () => {
            events.push(lockCount++ === 0 ? "menu-lock" : "media-lock");
          },
          mediaAsset: {
            findFirst: async () => {
              events.push("photo-revalidate");
              return { id: "photo_new", menu_item_photo: null };
            }
          },
          menu: { update: async () => ({ id: "menu_1" }) },
          menuItem: {
            findFirst: async () => {
              events.push("item-read");
              return { id: "item_1", photo_media_asset_id: "photo_actual" };
            },
            update: async () => {
              events.push("item-update");
            }
          }
        }),
      mediaAsset: {
        deleteMany: async () => ({ count: 1 }),
        findFirst: createMenuPhotoFindMock({
          id: "photo_new",
          storageKey: "org/org_1/menu/actual-old.jpg"
        }),
        updateMany: async ({ where }: { where: { id: string } }) => {
          cleanupClaims.push(where.id);
          return { count: where.id === "photo_actual" ? 1 : 0 };
        }
      },
      menu: {
        findUnique: async (query: { include?: unknown }) => (query.include ? storedMenu : null)
      },
      menuItem: {
        findFirst: async () => ({
          category: { menu_id: "menu_1" },
          category_id: "category_1",
          id: "item_1",
          photo_media_asset_id: "photo_stale"
        })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" }),
        findUnique: async () => ({ module_settings: [], subscription: activeSubscription })
      }
    } as never;

    await expect(
      updateOrganizationMenuItem(
        {
          input: { photoMediaAssetId: "photo_new" },
          itemId: "item_1",
          organizationId: "org_1"
        },
        db
      )
    ).resolves.toMatchObject({ organizationId: "org_1" });

    expect(events).toEqual([
      "menu-lock",
      "item-read",
      "media-lock",
      "photo-revalidate",
      "item-update"
    ]);
    expect(cleanupClaims).toEqual(["photo_actual"]);
    expect(cleanupClaims).not.toContain("photo_stale");
  });

  it("deletes an item under the menu lock and cleans its transaction-current photo", async () => {
    const events: string[] = [];
    const cleanupClaims: string[] = [];
    const storedMenu = {
      categories: [],
      content_locale: "en",
      currency_code: "USD",
      id: "menu_1",
      organization_id: "org_1",
      revision: 2
    };
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $queryRaw: async () => {
            events.push("menu-lock");
          },
          menu: { update: async () => ({ id: "menu_1" }) },
          menuItem: {
            delete: async () => {
              events.push("item-delete");
            },
            findFirst: async () => {
              events.push("item-read");
              return { id: "item_1", photo_media_asset_id: "photo_actual" };
            }
          }
        }),
      mediaAsset: {
        deleteMany: async () => ({ count: 1 }),
        findFirst: createMenuPhotoFindMock({
          id: "photo_actual",
          storageKey: "org/org_1/menu/deleted-actual.jpg"
        }),
        updateMany: async ({ where }: { where: { id: string } }) => {
          cleanupClaims.push(where.id);
          return { count: 1 };
        }
      },
      menu: {
        findUnique: async (query: { include?: unknown }) => (query.include ? storedMenu : null)
      },
      menuItem: {
        findFirst: async () => ({
          category: { menu_id: "menu_1" },
          category_id: "category_1",
          id: "item_1",
          photo_media_asset_id: "photo_stale"
        })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" }),
        findUnique: async () => ({ module_settings: [], subscription: activeSubscription })
      }
    } as never;

    await expect(
      deleteOrganizationMenuItem({ itemId: "item_1", organizationId: "org_1" }, db)
    ).resolves.toMatchObject({ organizationId: "org_1" });

    expect(events).toEqual(["menu-lock", "item-read", "item-delete"]);
    expect(cleanupClaims).toEqual(["photo_actual"]);
    expect(cleanupClaims).not.toContain("photo_stale");
  });

  it("cleans a newly uploaded photo when item creation transaction fails", async () => {
    const cleanupClaim = vi.fn(async () => ({ count: 1 }));
    const mediaDelete = vi.fn(async () => ({ count: 1 }));
    const transactionError = new Error("transaction failed");
    const db = {
      $transaction: async () => {
        throw transactionError;
      },
      mediaAsset: {
        deleteMany: mediaDelete,
        findFirst: createMenuPhotoFindMock({
          id: "photo_new",
          storageKey: "org/org_1/menu/new.jpg"
        }),
        updateMany: cleanupClaim
      },
      menuCategory: {
        findFirst: async () => ({ id: "category_1", menu_id: "menu_1" })
      },
      menuItem: {
        findFirst: async () => null
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      createOrganizationMenuItem(
        {
          categoryId: "category_1",
          input: {
            allergenCodes: [],
            clientRequestId: "create-item-photo-failure",
            description: "",
            dietaryTagCodes: [],
            isAvailable: true,
            isVisible: true,
            marketingTagCodes: [],
            name: "Dish",
            photoMediaAssetId: "photo_new",
            portionLabel: "",
            priceMinor: 1000,
            sortOrder: 0,
            spiceLevel: 0
          },
          organizationId: "org_1"
        },
        db
      )
    ).rejects.toBe(transactionError);

    expect(cleanupClaim).toHaveBeenCalledWith({
      data: { status: "DELETED", updated_at: expect.any(Date) },
      where: {
        id: "photo_new",
        kind: "MENU_ITEM_PHOTO",
        menu_item_photo: { is: null },
        owner_id: "org_1",
        owner_type: "ORGANIZATION",
        status: "READY"
      }
    });
    expect(mediaDelete).toHaveBeenCalledTimes(1);
  });

  it("cleans a redundant detached photo on an idempotent existing item request", async () => {
    const cleanupClaim = vi.fn(async () => ({ count: 1 }));
    const db = {
      mediaAsset: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
        findFirst: createMenuPhotoFindMock({
          id: "photo_extra",
          storageKey: "org/org_1/menu/idempotent-extra.jpg"
        }),
        updateMany: cleanupClaim
      },
      menu: {
        findUnique: async (query: { include?: unknown }) =>
          query.include
            ? {
                categories: [],
                content_locale: "en",
                currency_code: "USD",
                id: "menu_1",
                organization_id: "org_1",
                revision: 1
              }
            : { id: "menu_1" }
      },
      menuCategory: {
        findFirst: async () => ({ id: "category_1", menu_id: "menu_1" })
      },
      menuItem: {
        findFirst: async () => ({ id: "item_existing" })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" }),
        findUnique: async () => ({ module_settings: [], subscription: activeSubscription })
      }
    } as never;

    await expect(
      createOrganizationMenuItem(
        {
          categoryId: "category_1",
          input: {
            allergenCodes: [],
            clientRequestId: "idempotent-item-request",
            description: "",
            dietaryTagCodes: [],
            isAvailable: true,
            isVisible: true,
            marketingTagCodes: [],
            name: "Dish",
            photoMediaAssetId: "photo_extra",
            portionLabel: "",
            priceMinor: 1000,
            sortOrder: 0,
            spiceLevel: 0
          },
          organizationId: "org_1"
        },
        db
      )
    ).resolves.toMatchObject({ organizationId: "org_1" });

    expect(cleanupClaim).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "photo_extra" }) })
    );
  });

  it("cleans a replacement photo when item update transaction fails", async () => {
    const cleanupClaim = vi.fn(async () => ({ count: 1 }));
    const mediaDelete = vi.fn(async () => ({ count: 1 }));
    const transactionError = new Error("update transaction failed");
    const db = {
      $transaction: async () => {
        throw transactionError;
      },
      mediaAsset: {
        deleteMany: mediaDelete,
        findFirst: createMenuPhotoFindMock({
          id: "photo_replacement",
          storageKey: "org/org_1/menu/replacement.jpg"
        }),
        updateMany: cleanupClaim
      },
      menuItem: {
        findFirst: async () => ({
          category: { menu_id: "menu_1" },
          category_id: "category_1",
          id: "item_1",
          photo_media_asset_id: "photo_old"
        })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      updateOrganizationMenuItem(
        {
          input: { photoMediaAssetId: "photo_replacement" },
          itemId: "item_1",
          organizationId: "org_1"
        },
        db
      )
    ).rejects.toBe(transactionError);

    expect(cleanupClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "photo_replacement", menu_item_photo: { is: null } })
      })
    );
    expect(mediaDelete).toHaveBeenCalledTimes(1);
  });

  it("deletes only a detached photo owned by the requested organization", async () => {
    const assetFind = createMenuPhotoFindMock({
      id: "photo_detached",
      storageKey: "org/org_1/menu/detached.jpg"
    });
    const db = {
      mediaAsset: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
        findFirst: assetFind,
        updateMany: async () => ({ count: 1 })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      deleteDetachedOrganizationMenuPhoto(
        {
          mediaAssetId: "photo_detached",
          organizationId: "org_1"
        },
        db
      )
    ).resolves.toEqual({
      deleted: true,
      mediaAssetId: "photo_detached",
      organizationId: "org_1"
    });

    expect(assetFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "photo_detached",
          owner_id: "org_1",
          owner_type: "ORGANIZATION"
        })
      })
    );
  });

  it("sweeps only detached organization photos older than the grace period", async () => {
    const findMany = vi.fn(async () => []);
    const now = new Date("2026-08-24T12:00:00.000Z");

    await expect(
      cleanupStaleDetachedOrganizationMenuPhotos({ now, organizationId: "org_1" }, {
        mediaAsset: { findMany },
        organization: {
          findFirst: async () => ({ id: "org_1", locale: "en" })
        }
      } as never)
    ).resolves.toBe(0);

    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: expect.objectContaining({
          created_at: { lt: new Date("2026-08-23T12:00:00.000Z") },
          menu_item_photo: { is: null },
          owner_id: "org_1",
          status: "READY"
        })
      })
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updated_at: "asc" },
        take: 10,
        where: expect.objectContaining({
          kind: "MENU_ITEM_PHOTO",
          menu_item_photo: { is: null },
          owner_id: "org_1",
          owner_type: "ORGANIZATION",
          status: "DELETED",
          updated_at: { lt: new Date("2026-08-23T12:00:00.000Z") }
        })
      })
    );
  });

  it("recovers and deletes a stale claimed photo with an atomic scoped lease", async () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const deleteMany = vi.fn(async () => ({ count: 1 }));
    const findFirst = vi.fn(async () => ({
      bucket: "local-dev",
      storage_key: "org/org_1/menu/stale-claimed.jpg"
    }));
    const db = {
      mediaAsset: {
        deleteMany,
        findFirst,
        findMany: async ({ where }: { where: { status: string } }) =>
          where.status === "DELETED" ? [{ id: "photo_stale_claim" }] : [],
        updateMany
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      cleanupStaleDetachedOrganizationMenuPhotos({ now, organizationId: "org_1" }, db)
    ).resolves.toBe(1);

    expect(updateMany).toHaveBeenCalledWith({
      data: { updated_at: now },
      where: {
        id: "photo_stale_claim",
        kind: "MENU_ITEM_PHOTO",
        menu_item_photo: { is: null },
        owner_id: "org_1",
        owner_type: "ORGANIZATION",
        status: "DELETED",
        updated_at: { lt: new Date("2026-08-23T12:00:00.000Z") }
      }
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "photo_stale_claim",
          menu_item_photo: { is: null },
          owner_id: "org_1",
          status: "DELETED"
        })
      })
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: "photo_stale_claim",
        kind: "MENU_ITEM_PHOTO",
        menu_item_photo: { is: null },
        owner_id: "org_1",
        owner_type: "ORGANIZATION",
        status: "DELETED"
      }
    });
  });

  it("keeps a failed cleanup durably claimed for a later stale recovery", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const cleanupFailure = new Error("asset row delete failed");
    const consoleWarning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const db = {
      mediaAsset: {
        deleteMany: async () => {
          throw cleanupFailure;
        },
        findFirst: async () => ({
          bucket: "local-dev",
          storage_key: "org/org_1/menu/failed-cleanup.jpg"
        }),
        findMany: async ({ where }: { where: { status: string } }) =>
          where.status === "READY" ? [{ id: "photo_failed_cleanup" }] : [],
        updateMany
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    try {
      await expect(
        cleanupStaleDetachedOrganizationMenuPhotos(
          {
            now: new Date("2026-08-24T12:00:00.000Z"),
            organizationId: "org_1"
          },
          db
        )
      ).resolves.toBe(0);

      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: "DELETED",
            updated_at: expect.any(Date)
          }
        })
      );
      expect(updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "READY" } })
      );
      expect(consoleWarning).toHaveBeenCalledWith(
        "Detached menu photo cleanup failed",
        expect.objectContaining({ assetId: "photo_failed_cleanup" })
      );
    } finally {
      consoleWarning.mockRestore();
    }
  });

  it("does not resume a stale claim that fails the detached tenant-scoped recheck", async () => {
    const findFirst = vi.fn();
    const deleteMany = vi.fn();
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const db = {
      mediaAsset: {
        deleteMany,
        findFirst,
        findMany: async ({ where }: { where: { status: string } }) =>
          where.status === "DELETED" ? [{ id: "photo_no_longer_detached" }] : [],
        updateMany
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" })
      }
    } as never;

    await expect(
      cleanupStaleDetachedOrganizationMenuPhotos(
        {
          now: new Date("2026-08-24T12:00:00.000Z"),
          organizationId: "org_1"
        },
        db
      )
    ).resolves.toBe(0);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "MENU_ITEM_PHOTO",
          menu_item_photo: { is: null },
          owner_id: "org_1",
          owner_type: "ORGANIZATION",
          status: "DELETED"
        })
      })
    );
    expect(findFirst).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("durably claims category photos and schedules bounded cleanup without delaying the response", async () => {
    let activeCleanupCount = 0;
    let maxCleanupCount = 0;
    let releaseCleanup: () => void = () => undefined;
    const cleanupGate = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });
    const cleanupAttempt = vi.fn(async ({ where }: { where: { id: string } }) => {
      activeCleanupCount += 1;
      maxCleanupCount = Math.max(maxCleanupCount, activeCleanupCount);
      await cleanupGate;
      activeCleanupCount -= 1;
      return {
        bucket: "local-dev",
        storage_key: `org/org_1/menu/${where.id}.jpg`
      };
    });
    const durableClaim = vi.fn(async () => ({ count: 24 }));
    const photoCount = 24;
    const db = {
      $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          $queryRaw: async () => undefined,
          mediaAsset: { updateMany: durableClaim },
          menu: { update: async () => ({ id: "menu_1" }) },
          menuCategory: {
            delete: async () => ({ id: "category_1" }),
            findFirst: async () => ({ id: "category_1" })
          },
          menuItem: {
            findMany: async () =>
              Array.from({ length: photoCount }, (_, index) => ({
                photo_media_asset_id: `photo_${index}`
              }))
          }
        }),
      mediaAsset: {
        deleteMany: async () => ({ count: 1 }),
        findFirst: cleanupAttempt
      },
      menu: {
        findUnique: async (query: { include?: unknown }) =>
          query.include
            ? {
                categories: [],
                content_locale: "en",
                currency_code: "USD",
                id: "menu_1",
                organization_id: "org_1",
                revision: 2
              }
            : { id: "menu_1" }
      },
      menuCategory: {
        findFirst: async () => ({ id: "category_1", menu_id: "menu_1" })
      },
      organization: {
        findFirst: async () => ({ id: "org_1", locale: "en" }),
        findUnique: async () => ({ module_settings: [], subscription: activeSubscription })
      }
    } as never;

    const deletion = deleteOrganizationMenuCategory(
      { categoryId: "category_1", organizationId: "org_1" },
      db
    );
    const outcome = await Promise.race([
      deletion.then(() => "resolved" as const),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 100))
    ]);

    releaseCleanup();
    await deletion;

    expect(outcome).toBe("resolved");
    expect(durableClaim).toHaveBeenCalledTimes(1);
    expect(durableClaim).toHaveBeenCalledWith({
      data: {
        status: "DELETED",
        updated_at: expect.any(Date)
      },
      where: {
        id: { in: Array.from({ length: photoCount }, (_, index) => `photo_${index}`) },
        kind: "MENU_ITEM_PHOTO",
        owner_id: "org_1",
        owner_type: "ORGANIZATION",
        status: "READY"
      }
    });

    await vi.waitFor(() => {
      expect(cleanupAttempt).toHaveBeenCalledTimes(photoCount);
    });

    expect(maxCleanupCount).toBeLessThanOrEqual(8);
    expect(maxCleanupCount).toBeGreaterThan(1);
  });
});
