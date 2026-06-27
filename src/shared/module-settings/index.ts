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

export const PUBLIC_REVIEW_PROVIDER_IDS = ["google", "yandex", "2gis"] as const;
export const PUBLIC_REVIEW_LINK_MAX_COUNT = PUBLIC_REVIEW_PROVIDER_IDS.length;
export const PUBLIC_REVIEW_LINK_ID_MAX_LENGTH = 80;
export const PUBLIC_REVIEW_LINK_LABEL_MAX_LENGTH = 80;
export const PUBLIC_REVIEW_LINK_URL_MAX_LENGTH = 1000;
export const PUBLIC_REVIEW_MIN_RATING = 1;
export const PUBLIC_REVIEW_MAX_RATING = 4;
export const PUBLIC_REVIEW_DEFAULT_MIN_RATING = 4;

export type PublicReviewProviderId = (typeof PUBLIC_REVIEW_PROVIDER_IDS)[number];

const publicReviewProviderIdSchema = z.enum(PUBLIC_REVIEW_PROVIDER_IDS);
const isPublicReviewProviderId = (value: unknown): value is PublicReviewProviderId =>
  typeof value === "string" && PUBLIC_REVIEW_PROVIDER_IDS.includes(value as PublicReviewProviderId);
const normalizeUrlHostname = (url: string) =>
  new URL(url).hostname.toLowerCase().replace(/\.$/, "");
const hasDomainPart = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`);
const hasAnyDomainPart = (hostname: string, domains: readonly string[]) =>
  domains.some((domain) => hasDomainPart(hostname, domain));

const publicReviewProviderHostRules = {
  "2gis": (hostname: string) =>
    hasAnyDomainPart(hostname, ["2gis.ru", "2gis.uz", "2gis.kz", "2gis.kg", "2gis.ae", "2gis.com"]),
  google: (hostname: string) =>
    hasAnyDomainPart(hostname, ["google.com", "g.page", "maps.app.goo.gl", "goo.gl", "g.co"]),
  yandex: (hostname: string) =>
    hasAnyDomainPart(hostname, [
      "yandex.ru",
      "yandex.com",
      "yandex.uz",
      "yandex.kz",
      "yandex.tj",
      "yandex.az",
      "ya.ru"
    ])
} satisfies Record<PublicReviewProviderId, (hostname: string) => boolean>;

export const isAllowedPublicReviewUrl = (provider: PublicReviewProviderId, url: string) => {
  try {
    return publicReviewProviderHostRules[provider](normalizeUrlHostname(url));
  } catch {
    return false;
  }
};

const publicReviewUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(PUBLIC_REVIEW_LINK_URL_MAX_LENGTH)
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);

      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  });

export const publicReviewLinkSchema = z
  .object({
    enabled: z.boolean().default(true),
    id: z
      .string()
      .trim()
      .min(1)
      .max(PUBLIC_REVIEW_LINK_ID_MAX_LENGTH)
      .regex(/^[a-z0-9_-]+$/i),
    label: z.string().trim().min(1).max(PUBLIC_REVIEW_LINK_LABEL_MAX_LENGTH),
    provider: publicReviewProviderIdSchema,
    sortOrder: z.number().int().min(0).max(999).default(0),
    url: publicReviewUrlSchema
  })
  .strict()
  .superRefine((link, context) => {
    if (link.id !== link.provider) {
      context.addIssue({
        code: "custom",
        message: "Public review link id must match provider.",
        path: ["id"]
      });
    }

    if (!isAllowedPublicReviewUrl(link.provider, link.url)) {
      context.addIssue({
        code: "custom",
        message: "Public review link URL does not match provider.",
        path: ["url"]
      });
    }
  });

const publicReviewSettingsObjectSchema = z
  .object({
    enabled: z.boolean().default(false),
    links: z.array(publicReviewLinkSchema).max(PUBLIC_REVIEW_LINK_MAX_COUNT).default([]),
    minRating: z
      .number()
      .int()
      .min(PUBLIC_REVIEW_MIN_RATING)
      .max(PUBLIC_REVIEW_MAX_RATING)
      .default(PUBLIC_REVIEW_DEFAULT_MIN_RATING)
  })
  .superRefine((settings, context) => {
    const seenProviders = new Set<PublicReviewProviderId>();

    settings.links.forEach((link, index) => {
      if (seenProviders.has(link.provider)) {
        context.addIssue({
          code: "custom",
          message: "Public review provider must be unique.",
          path: ["links", index, "provider"]
        });
      }

      seenProviders.add(link.provider);
    });
  });

export const publicReviewSettingsSchema = publicReviewSettingsObjectSchema.default({
  enabled: false,
  links: [],
  minRating: PUBLIC_REVIEW_DEFAULT_MIN_RATING
});
const publicReviewSettingsPatchSchema = z.object({
  enabled: z.boolean().optional(),
  links: z.array(publicReviewLinkSchema).max(PUBLIC_REVIEW_LINK_MAX_COUNT).optional(),
  minRating: z.number().int().min(PUBLIC_REVIEW_MIN_RATING).max(PUBLIC_REVIEW_MAX_RATING).optional()
});

export const reviewModuleSettingsSchema = z.object({
  commentRequired: z.boolean().default(false),
  contactEnabled: z.boolean().default(true),
  lowRatingCommentEnabled: z.boolean().default(true),
  lowRatingThreshold: z.number().int().min(1).max(5).default(3),
  photosEnabled: z.boolean().default(true),
  publicReview: publicReviewSettingsSchema
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
  review: reviewModuleSettingsSchema.omit({ publicReview: true }).partial().extend({
    publicReview: publicReviewSettingsPatchSchema.optional()
  }),
  staff: staffModuleSettingsSchema.partial(),
  suggestion: suggestionModuleSettingsSchema.partial()
} as const satisfies Record<GuestMenuItemId, z.ZodType>;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeStoredPublicReviewLink = (
  value: unknown,
  seenProviders: Set<PublicReviewProviderId>
): PublicReviewLink | null => {
  if (!isObjectRecord(value) || !isPublicReviewProviderId(value.provider)) {
    return null;
  }

  if (seenProviders.has(value.provider)) {
    return null;
  }

  const provider = value.provider;
  const parsed = publicReviewLinkSchema.safeParse({
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    id: provider,
    label: typeof value.label === "string" && value.label.trim() ? value.label : provider,
    provider,
    sortOrder:
      typeof value.sortOrder === "number"
        ? value.sortOrder
        : PUBLIC_REVIEW_PROVIDER_IDS.indexOf(provider),
    url: typeof value.url === "string" ? value.url : ""
  });

  if (!parsed.success) {
    return null;
  }

  seenProviders.add(provider);

  return parsed.data;
};

const normalizePublicReviewMinRating = (value: unknown) => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }

  return Math.min(PUBLIC_REVIEW_MAX_RATING, Math.max(PUBLIC_REVIEW_MIN_RATING, value));
};

const sanitizeStoredPublicReviewSettings = (config: Record<string, unknown>) => {
  if (!isObjectRecord(config.publicReview)) {
    return config;
  }

  const seenProviders = new Set<PublicReviewProviderId>();

  return {
    ...config,
    publicReview: {
      ...config.publicReview,
      links: Array.isArray(config.publicReview.links)
        ? config.publicReview.links
            .map((link) => normalizeStoredPublicReviewLink(link, seenProviders))
            .filter((link): link is PublicReviewLink => Boolean(link))
        : undefined,
      minRating: normalizePublicReviewMinRating(config.publicReview.minRating)
    }
  };
};

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

  if (itemId === "review") {
    return sanitizeStoredPublicReviewSettings(config);
  }

  return config;
};

export type ReviewModuleSettings = z.infer<typeof reviewModuleSettingsSchema>;
export type ComplaintModuleSettings = z.infer<typeof complaintModuleSettingsSchema>;
export type SuggestionModuleSettings = z.infer<typeof suggestionModuleSettingsSchema>;
export type StaffModuleSettings = z.infer<typeof staffModuleSettingsSchema>;
export type PublicReviewLink = z.infer<typeof publicReviewLinkSchema>;
export type PublicReviewSettings = z.infer<typeof publicReviewSettingsSchema>;

export type ModuleSettingsById = {
  complaint: ComplaintModuleSettings;
  review: ReviewModuleSettings;
  staff: StaffModuleSettings;
  suggestion: SuggestionModuleSettings;
};

export const getEnabledPublicReviewLinks = (settings: ReviewModuleSettings) =>
  [...settings.publicReview.links]
    .filter((link) => link.enabled)
    .sort(
      (first, second) =>
        first.sortOrder - second.sortOrder || first.label.localeCompare(second.label)
    );

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
    ...parsedPatch,
    ...(itemId === "review" && "publicReview" in parsedPatch
      ? {
          publicReview: publicReviewSettingsSchema.parse({
            ...(parsedCurrent as ReviewModuleSettings).publicReview,
            ...(parsedPatch as Partial<ReviewModuleSettings>).publicReview
          })
        }
      : {})
  }) as ModuleSettingsById[T];
};

export const getModuleBySettingsItemId = (itemId: GuestMenuItemId) =>
  GUEST_MENU_MODULE_BY_ID[itemId];
