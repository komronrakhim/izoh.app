import { z } from "zod";

import { APP_LOCALES, type AppLocale } from "~/shared/i18n";

export const MENU_CATEGORY_LIMIT = 100;
export const MENU_ITEMS_PER_CATEGORY_LIMIT = 500;
export const MENU_TOTAL_ITEM_LIMIT = 500;
export const MENU_NAME_MAX_LENGTH = 120;
export const MENU_DESCRIPTION_MAX_LENGTH = 1200;
export const MENU_PORTION_LABEL_MAX_LENGTH = 80;

// Active tender currencies reconciled with the official ISO 4217 List One.
// Fund, precious-metal, accounting-unit, and testing codes are intentionally excluded.
export const MENU_CURRENCY_CODES = [
  "AED",
  "AFN",
  "ALL",
  "AMD",
  "AOA",
  "ARS",
  "AUD",
  "AWG",
  "AZN",
  "BAM",
  "BBD",
  "BDT",
  "BHD",
  "BIF",
  "BMD",
  "BND",
  "BOB",
  "BRL",
  "BSD",
  "BTN",
  "BWP",
  "BYN",
  "BZD",
  "CAD",
  "CDF",
  "CHF",
  "CLP",
  "CNY",
  "COP",
  "CRC",
  "CUP",
  "CVE",
  "CZK",
  "DJF",
  "DKK",
  "DOP",
  "DZD",
  "EGP",
  "ERN",
  "ETB",
  "EUR",
  "FJD",
  "FKP",
  "GBP",
  "GEL",
  "GHS",
  "GIP",
  "GMD",
  "GNF",
  "GTQ",
  "GYD",
  "HKD",
  "HNL",
  "HTG",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "IQD",
  "IRR",
  "ISK",
  "JMD",
  "JOD",
  "JPY",
  "KES",
  "KGS",
  "KHR",
  "KMF",
  "KPW",
  "KRW",
  "KWD",
  "KYD",
  "KZT",
  "LAK",
  "LBP",
  "LKR",
  "LRD",
  "LSL",
  "LYD",
  "MAD",
  "MDL",
  "MGA",
  "MKD",
  "MMK",
  "MNT",
  "MOP",
  "MRU",
  "MUR",
  "MVR",
  "MWK",
  "MXN",
  "MYR",
  "MZN",
  "NAD",
  "NGN",
  "NIO",
  "NOK",
  "NPR",
  "NZD",
  "OMR",
  "PAB",
  "PEN",
  "PGK",
  "PHP",
  "PKR",
  "PLN",
  "PYG",
  "QAR",
  "RON",
  "RSD",
  "RUB",
  "RWF",
  "SAR",
  "SBD",
  "SCR",
  "SDG",
  "SEK",
  "SGD",
  "SHP",
  "SLE",
  "SOS",
  "SRD",
  "SSP",
  "STN",
  "SVC",
  "SYP",
  "SZL",
  "THB",
  "TJS",
  "TMT",
  "TND",
  "TOP",
  "TRY",
  "TTD",
  "TWD",
  "TZS",
  "UAH",
  "UGX",
  "USD",
  "UYU",
  "UZS",
  "VED",
  "VES",
  "VND",
  "VUV",
  "WST",
  "XAF",
  "XCD",
  "XCG",
  "XOF",
  "XPF",
  "YER",
  "ZAR",
  "ZMW",
  "ZWG"
] as const;

export type MenuCurrencyCode = (typeof MENU_CURRENCY_CODES)[number];

// ISO 4217 accounting exponents. These intentionally do not use CLDR cash-format defaults.
const zeroMinorUnitCurrencyCodes = new Set<MenuCurrencyCode>([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF"
]);
const threeMinorUnitCurrencyCodes = new Set<MenuCurrencyCode>([
  "BHD",
  "IQD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND"
]);

export const MENU_CURRENCY_MINOR_UNITS = Object.fromEntries(
  MENU_CURRENCY_CODES.map((code) => [
    code,
    zeroMinorUnitCurrencyCodes.has(code) ? 0 : threeMinorUnitCurrencyCodes.has(code) ? 3 : 2
  ])
) as Record<MenuCurrencyCode, 0 | 2 | 3>;

export const getMenuCurrencyMinorUnit = (code: MenuCurrencyCode) => MENU_CURRENCY_MINOR_UNITS[code];

export const MENU_SPICE_LEVELS = [0, 1, 2, 3] as const;
export type MenuSpiceLevel = (typeof MENU_SPICE_LEVELS)[number];

export const MENU_DIETARY_TAG_CODES = [
  "vegetarian",
  "vegan",
  "halal",
  "gluten_free",
  "lactose_free"
] as const;
export type MenuDietaryTagCode = (typeof MENU_DIETARY_TAG_CODES)[number];

export const MENU_MARKETING_TAG_CODES = ["new", "popular", "chef_choice", "seasonal"] as const;
export type MenuMarketingTagCode = (typeof MENU_MARKETING_TAG_CODES)[number];

export const MENU_ALLERGEN_CODES = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "tree_nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs"
] as const;
export type MenuAllergenCode = (typeof MENU_ALLERGEN_CODES)[number];

export const menuCurrencyCodeSchema = z.enum(MENU_CURRENCY_CODES);
export const menuSpiceLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3)
]);
export const menuDietaryTagCodeSchema = z.enum(MENU_DIETARY_TAG_CODES);
export const menuMarketingTagCodeSchema = z.enum(MENU_MARKETING_TAG_CODES);
export const menuAllergenCodeSchema = z.enum(MENU_ALLERGEN_CODES);

const menuContentLocaleSchema = z.enum(APP_LOCALES);
const menuClientRequestIdSchema = z.string().trim().min(8).max(120);
const menuNameSchema = z.string().trim().min(1).max(MENU_NAME_MAX_LENGTH);
const menuDescriptionSchema = z.string().trim().max(MENU_DESCRIPTION_MAX_LENGTH);
const menuPortionLabelSchema = z.string().trim().max(MENU_PORTION_LABEL_MAX_LENGTH);
const menuSortOrderSchema = z.number().int().min(0).max(1_000_000);
const menuPriceMinorSchema = z.number().int().min(0).max(2_000_000_000);

const uniqueCodeArray = <T extends z.ZodType>(schema: T, max: number) =>
  z
    .array(schema)
    .max(max)
    .refine((values) => new Set(values).size === values.length, "Menu codes must be unique.");

export const createMenuSchema = z
  .object({
    contentLocale: menuContentLocaleSchema.optional(),
    currencyCode: menuCurrencyCodeSchema
  })
  .strict();

export const updateMenuSchema = z
  .object({
    contentLocale: menuContentLocaleSchema.optional(),
    currencyCode: menuCurrencyCodeSchema.optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "At least one menu field is required.");

export const menuModuleEnabledSchema = z
  .object({
    enabled: z.boolean()
  })
  .strict();

export const reorderMenuEntitiesSchema = z
  .object({
    orderedIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(500)
      .refine((ids) => new Set(ids).size === ids.length, "Menu reorder IDs must be unique.")
  })
  .strict();

export const createMenuCategorySchema = z
  .object({
    clientRequestId: menuClientRequestIdSchema,
    isVisible: z.boolean().default(true),
    name: menuNameSchema,
    sortOrder: menuSortOrderSchema.default(0)
  })
  .strict();

export const updateMenuCategorySchema = z
  .object({
    isVisible: z.boolean().optional(),
    name: menuNameSchema.optional()
  })
  .strict()
  .refine(
    (input) => Object.keys(input).length > 0,
    "At least one menu category field is required."
  );

const menuItemFields = {
  allergenCodes: uniqueCodeArray(menuAllergenCodeSchema, MENU_ALLERGEN_CODES.length),
  description: menuDescriptionSchema,
  dietaryTagCodes: uniqueCodeArray(menuDietaryTagCodeSchema, MENU_DIETARY_TAG_CODES.length),
  isAvailable: z.boolean(),
  isVisible: z.boolean(),
  marketingTagCodes: uniqueCodeArray(menuMarketingTagCodeSchema, MENU_MARKETING_TAG_CODES.length),
  name: menuNameSchema,
  photoMediaAssetId: z.string().trim().min(1).nullable(),
  portionLabel: menuPortionLabelSchema,
  priceMinor: menuPriceMinorSchema,
  sortOrder: menuSortOrderSchema,
  spiceLevel: menuSpiceLevelSchema
};

export const createMenuItemSchema = z
  .object({
    ...menuItemFields,
    allergenCodes: menuItemFields.allergenCodes.default([]),
    clientRequestId: menuClientRequestIdSchema,
    description: menuItemFields.description.default(""),
    dietaryTagCodes: menuItemFields.dietaryTagCodes.default([]),
    isAvailable: menuItemFields.isAvailable.default(true),
    isVisible: menuItemFields.isVisible.default(true),
    marketingTagCodes: menuItemFields.marketingTagCodes.default([]),
    photoMediaAssetId: menuItemFields.photoMediaAssetId.default(null),
    portionLabel: menuItemFields.portionLabel.default(""),
    sortOrder: menuItemFields.sortOrder.default(0),
    spiceLevel: menuItemFields.spiceLevel.default(0)
  })
  .strict();

export const updateMenuItemSchema = z
  .object({
    allergenCodes: menuItemFields.allergenCodes.optional(),
    description: menuItemFields.description.optional(),
    dietaryTagCodes: menuItemFields.dietaryTagCodes.optional(),
    isAvailable: menuItemFields.isAvailable.optional(),
    isVisible: menuItemFields.isVisible.optional(),
    marketingTagCodes: menuItemFields.marketingTagCodes.optional(),
    name: menuItemFields.name.optional(),
    photoMediaAssetId: menuItemFields.photoMediaAssetId.optional(),
    portionLabel: menuItemFields.portionLabel.optional(),
    priceMinor: menuItemFields.priceMinor.optional(),
    spiceLevel: menuItemFields.spiceLevel.optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "At least one menu item field is required.");

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type ReorderMenuEntitiesInput = z.infer<typeof reorderMenuEntitiesSchema>;

export type MenuCurrency = {
  code: MenuCurrencyCode;
  minorUnit: 0 | 2 | 3;
};

export type MenuItemPayload = {
  allergenCodes: MenuAllergenCode[];
  categoryId: string;
  description: string;
  dietaryTagCodes: MenuDietaryTagCode[];
  id: string;
  isAvailable: boolean;
  isVisible: boolean;
  marketingTagCodes: MenuMarketingTagCode[];
  name: string;
  photoMediaAssetId: null | string;
  photoUrl: null | string;
  portionLabel: string;
  priceMinor: number;
  sortOrder: number;
  spiceLevel: MenuSpiceLevel;
};

export type MenuCategoryPayload = {
  id: string;
  isVisible: boolean;
  items: MenuItemPayload[];
  name: string;
  sortOrder: number;
};

export type MenuPayload = {
  categories: MenuCategoryPayload[];
  contentLocale: AppLocale;
  currency: MenuCurrency;
  id: string;
  revision: number;
};

export type AdminMenuPayload = {
  guestAvailable: boolean;
  menu: MenuPayload | null;
  moduleEnabled: boolean;
  organizationId: string;
};

export type AdminMenuSummaryPayload = {
  guestAvailable: boolean;
  moduleEnabled: boolean;
  organizationId: string;
};

export type DeleteDetachedMenuPhotoPayload = {
  deleted: true;
  mediaAssetId: string;
  organizationId: string;
};

export type GuestMenuSummary = {
  available: boolean;
};

export type GuestMenuPayload = {
  menu: MenuPayload;
  organizationId: string;
};
