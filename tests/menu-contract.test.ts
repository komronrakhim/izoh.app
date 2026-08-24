import { describe, expect, it } from "vitest";

import {
  createMenuItemSchema,
  getMenuCurrencyMinorUnit,
  MENU_CATEGORY_LIMIT,
  MENU_ITEMS_PER_CATEGORY_LIMIT,
  MENU_TOTAL_ITEM_LIMIT,
  menuCurrencyCodeSchema,
  reorderMenuEntitiesSchema,
  updateMenuCategorySchema,
  updateMenuItemSchema
} from "~/shared/menu";

describe("menu contracts", () => {
  it("bounds a live catalog to a mobile-safe v1 payload", () => {
    expect(MENU_CATEGORY_LIMIT).toBe(100);
    expect(MENU_ITEMS_PER_CATEGORY_LIMIT).toBe(500);
    expect(MENU_TOTAL_ITEM_LIMIT).toBe(500);
  });

  it("uses ISO 4217 accounting minor units for representative currencies", () => {
    expect(getMenuCurrencyMinorUnit("UZS")).toBe(2);
    expect(getMenuCurrencyMinorUnit("VED")).toBe(2);
    expect(getMenuCurrencyMinorUnit("IQD")).toBe(3);
    expect(getMenuCurrencyMinorUnit("JPY")).toBe(0);
    expect(getMenuCurrencyMinorUnit("USD")).toBe(2);
  });

  it("does not accept withdrawn currency codes", () => {
    expect(menuCurrencyCodeSchema.safeParse("ANG").success).toBe(false);
    expect(menuCurrencyCodeSchema.safeParse("BGN").success).toBe(false);
    expect(menuCurrencyCodeSchema.safeParse("CUC").success).toBe(false);
    expect(menuCurrencyCodeSchema.safeParse("SLL").success).toBe(false);
    expect(menuCurrencyCodeSchema.safeParse("HRK").success).toBe(false);
    expect(menuCurrencyCodeSchema.safeParse("ZWL").success).toBe(false);
    expect(menuCurrencyCodeSchema.safeParse("VED").success).toBe(true);
  });

  it("requires an exact integer price and normalizes optional item fields", () => {
    const item = createMenuItemSchema.parse({
      clientRequestId: "menu-item-request-1",
      name: "Лагман",
      priceMinor: 4500
    });

    expect(item).toMatchObject({
      allergenCodes: [],
      description: "",
      isAvailable: true,
      isVisible: true,
      photoMediaAssetId: null,
      spiceLevel: 0
    });
    expect(createMenuItemSchema.safeParse({ name: "Free" }).success).toBe(false);
    expect(
      createMenuItemSchema.safeParse({
        clientRequestId: "menu-item-request-2",
        name: "Invalid",
        priceMinor: 10.5
      }).success
    ).toBe(false);
  });

  it("allows focused live patches and rejects duplicate reorder IDs", () => {
    expect(updateMenuItemSchema.parse({ isAvailable: false })).toEqual({ isAvailable: false });
    expect(updateMenuItemSchema.safeParse({}).success).toBe(false);
    expect(updateMenuItemSchema.safeParse({ categoryId: "category_2" }).success).toBe(false);
    expect(updateMenuItemSchema.safeParse({ sortOrder: 2 }).success).toBe(false);
    expect(updateMenuCategorySchema.safeParse({ sortOrder: 2 }).success).toBe(false);
    expect(reorderMenuEntitiesSchema.safeParse({ orderedIds: ["a", "a"] }).success).toBe(false);
  });
});
