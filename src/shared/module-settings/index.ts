import { z } from "zod";

import {
  GUEST_MENU_MODULE_BY_ID,
  type GuestMenuItemId,
  type GuestMenuModule
} from "~/shared/guest-menu";

export const COMPLAINT_CATEGORY_IDS = [
  "service",
  "quality",
  "cleanliness",
  "wait",
  "payment",
  "conditions",
  "other"
] as const;

export type ComplaintCategoryId = (typeof COMPLAINT_CATEGORY_IDS)[number];

const complaintCategoryIdSchema = z.enum(COMPLAINT_CATEGORY_IDS);

export const SUGGESTION_TOPIC_IDS = [
  "service",
  "product",
  "comfort",
  "price",
  "speed",
  "events",
  "other"
] as const;

export type SuggestionTopicId = (typeof SUGGESTION_TOPIC_IDS)[number];

const suggestionTopicIdSchema = z.enum(SUGGESTION_TOPIC_IDS);

export const reviewModuleSettingsSchema = z.object({
  commentRequired: z.boolean().default(false),
  contactEnabled: z.boolean().default(true),
  lowRatingCommentEnabled: z.boolean().default(true),
  lowRatingThreshold: z.number().int().min(1).max(5).default(3),
  photosEnabled: z.boolean().default(true)
});

export const complaintModuleSettingsSchema = z.object({
  categoriesEnabled: z.boolean().default(true),
  commentRequired: z.boolean().default(true),
  complaintCategoryIds: z
    .array(complaintCategoryIdSchema)
    .min(1)
    .default([...COMPLAINT_CATEGORY_IDS]),
  contactEnabled: z.boolean().default(true),
  contactRequired: z.boolean().default(false),
  photosEnabled: z.boolean().default(true)
});

export const suggestionModuleSettingsSchema = z.object({
  categoriesEnabled: z.boolean().default(true),
  contactEnabled: z.boolean().default(false),
  contactRequired: z.boolean().default(false),
  photosEnabled: z.boolean().default(true),
  suggestionTopicIds: z
    .array(suggestionTopicIdSchema)
    .min(1)
    .default([...SUGGESTION_TOPIC_IDS])
});

export const staffModuleSettingsSchema = z.object({
  allowTeamReview: z.boolean().default(true),
  guestSelectionEnabled: z.boolean().default(true)
});

const moduleSettingsSchemaById = {
  complaint: complaintModuleSettingsSchema,
  review: reviewModuleSettingsSchema,
  staff: staffModuleSettingsSchema,
  suggestion: suggestionModuleSettingsSchema
} as const satisfies Record<GuestMenuItemId, z.ZodType>;

const moduleSettingsPatchSchemaById = {
  complaint: complaintModuleSettingsSchema.partial(),
  review: reviewModuleSettingsSchema.partial(),
  staff: staffModuleSettingsSchema.partial(),
  suggestion: suggestionModuleSettingsSchema.partial()
} as const satisfies Record<GuestMenuItemId, z.ZodType>;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeStoredIdArray = <T extends readonly string[]>(value: unknown, allowedIds: T) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const allowedIdSet = new Set<string>(allowedIds);
  const sanitized = value.filter(
    (id): id is T[number] => typeof id === "string" && allowedIdSet.has(id)
  );

  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeStoredModuleSettingsConfig = <T extends GuestMenuItemId>({
  config,
  itemId
}: {
  config: unknown;
  itemId: T;
}) => {
  if (!isObjectRecord(config)) {
    return config;
  }

  if (itemId === "complaint") {
    return {
      ...config,
      complaintCategoryIds: sanitizeStoredIdArray(
        config.complaintCategoryIds,
        COMPLAINT_CATEGORY_IDS
      )
    };
  }

  if (itemId === "suggestion") {
    return {
      ...config,
      suggestionTopicIds: sanitizeStoredIdArray(config.suggestionTopicIds, SUGGESTION_TOPIC_IDS)
    };
  }

  return config;
};

export type ReviewModuleSettings = z.infer<typeof reviewModuleSettingsSchema>;
export type ComplaintModuleSettings = z.infer<typeof complaintModuleSettingsSchema>;
export type SuggestionModuleSettings = z.infer<typeof suggestionModuleSettingsSchema>;
export type StaffModuleSettings = z.infer<typeof staffModuleSettingsSchema>;

export type ModuleSettingsById = {
  complaint: ComplaintModuleSettings;
  review: ReviewModuleSettings;
  staff: StaffModuleSettings;
  suggestion: SuggestionModuleSettings;
};

export type ModuleSettingsPayload<T extends GuestMenuItemId = GuestMenuItemId> = {
  enabled: boolean;
  itemId: T;
  module: GuestMenuModule;
  organizationId: string;
  settings: ModuleSettingsById[T];
};

export const getDefaultModuleSettings = <T extends GuestMenuItemId>(
  itemId: T
): ModuleSettingsById[T] => moduleSettingsSchemaById[itemId].parse({}) as ModuleSettingsById[T];

export const parseModuleSettingsConfig = <T extends GuestMenuItemId>({
  config,
  itemId
}: {
  config: unknown;
  itemId: T;
}): ModuleSettingsById[T] =>
  moduleSettingsSchemaById[itemId].parse(
    sanitizeStoredModuleSettingsConfig({
      config: config ?? {},
      itemId
    })
  ) as ModuleSettingsById[T];

export const parseModuleSettingsPatch = <T extends GuestMenuItemId>({
  itemId,
  patch
}: {
  itemId: T;
  patch: unknown;
}) => {
  const parsedPatch = moduleSettingsPatchSchemaById[itemId].parse(patch) as Partial<
    ModuleSettingsById[T]
  >;

  if (!isObjectRecord(patch)) {
    return parsedPatch;
  }

  return Object.fromEntries(
    Object.keys(patch)
      .filter((key) => patch[key] !== undefined && key in parsedPatch)
      .map((key) => [key, parsedPatch[key as keyof typeof parsedPatch]])
  ) as Partial<ModuleSettingsById[T]>;
};

export const mergeModuleSettings = <T extends GuestMenuItemId>({
  current,
  itemId,
  patch
}: {
  current?: unknown;
  itemId: T;
  patch: unknown;
}): ModuleSettingsById[T] => {
  const parsedCurrent = parseModuleSettingsConfig({
    config: current,
    itemId
  });
  const parsedPatch = parseModuleSettingsPatch({
    itemId,
    patch
  });

  return moduleSettingsSchemaById[itemId].parse({
    ...parsedCurrent,
    ...parsedPatch
  }) as ModuleSettingsById[T];
};

export const getModuleBySettingsItemId = (itemId: GuestMenuItemId) =>
  GUEST_MENU_MODULE_BY_ID[itemId];
