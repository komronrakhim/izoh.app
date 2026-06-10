import type { GuestMenuItem, GuestMenuItemId } from "~/shared/guest-menu";
import { GUEST_MENU_ITEM_IDS, GUEST_MENU_MODULE_BY_ID } from "~/shared/guest-menu";
import { getDefaultModuleSettings, type ModuleSettingsById } from "~/shared/module-settings";

export const ORGANIZATION_PRESET_IDS = ["cafe", "retail", "services", "other"] as const;

export type OrganizationPresetId = (typeof ORGANIZATION_PRESET_IDS)[number];

export const DEFAULT_ORGANIZATION_PRESET_ID: OrganizationPresetId = "cafe";

type PresetModuleItem<T extends GuestMenuItemId = GuestMenuItemId> = GuestMenuItem & {
  id: T;
  settings: ModuleSettingsById[T];
};

type PresetModuleConfig = {
  [T in GuestMenuItemId]: {
    enabled: boolean;
    settings: ModuleSettingsById[T];
  };
};

const createDefaultConfig = (): PresetModuleConfig => ({
  complaint: {
    enabled: true,
    settings: getDefaultModuleSettings("complaint")
  },
  review: {
    enabled: true,
    settings: getDefaultModuleSettings("review")
  },
  staff: {
    enabled: false,
    settings: getDefaultModuleSettings("staff")
  },
  suggestion: {
    enabled: true,
    settings: getDefaultModuleSettings("suggestion")
  }
});

const createPresetConfig = (presetId: OrganizationPresetId): PresetModuleConfig => {
  const config = createDefaultConfig();

  if (presetId === "cafe") {
    config.staff.enabled = true;
    config.complaint.settings = {
      ...config.complaint.settings,
      complaintCategoryIds: ["service", "quality", "cleanliness", "wait", "payment", "other"]
    };
    config.suggestion.settings = {
      ...config.suggestion.settings,
      suggestionTopicIds: ["service", "comfort", "speed", "events", "other"]
    };
  }

  if (presetId === "retail") {
    config.staff.enabled = false;
    config.complaint.settings = {
      ...config.complaint.settings,
      complaintCategoryIds: ["quality", "payment", "conditions", "service", "other"]
    };
    config.suggestion.settings = {
      ...config.suggestion.settings,
      suggestionTopicIds: ["product", "price", "service", "other"]
    };
  }

  if (presetId === "services") {
    config.staff.enabled = true;
    config.complaint.settings = {
      ...config.complaint.settings,
      complaintCategoryIds: ["service", "quality", "wait", "payment", "other"]
    };
    config.suggestion.settings = {
      ...config.suggestion.settings,
      suggestionTopicIds: ["service", "comfort", "speed", "price", "other"]
    };
  }

  return config;
};

export const getOrganizationPresetItems = (
  presetId: OrganizationPresetId = DEFAULT_ORGANIZATION_PRESET_ID
): PresetModuleItem[] => {
  const config = createPresetConfig(presetId);

  return GUEST_MENU_ITEM_IDS.map((id) => ({
    enabled: config[id].enabled,
    id,
    module: GUEST_MENU_MODULE_BY_ID[id],
    settings: config[id].settings
  })) as PresetModuleItem[];
};
