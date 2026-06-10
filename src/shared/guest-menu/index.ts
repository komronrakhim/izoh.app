export const GUEST_MENU_ITEM_IDS = ["review", "complaint", "suggestion", "staff"] as const;

export type GuestMenuItemId = (typeof GUEST_MENU_ITEM_IDS)[number];
export type GuestMenuModule = "COMPLAINT" | "REVIEW" | "STAFF" | "SUGGESTION";

export type GuestMenuItem = {
  enabled: boolean;
  id: GuestMenuItemId;
  module: GuestMenuModule;
};

export const GUEST_MENU_MODULE_BY_ID = {
  complaint: "COMPLAINT",
  review: "REVIEW",
  staff: "STAFF",
  suggestion: "SUGGESTION"
} as const satisfies Record<GuestMenuItemId, GuestMenuModule>;

export const DEFAULT_GUEST_MENU_ENABLED_BY_ID = {
  complaint: true,
  review: true,
  staff: false,
  suggestion: true
} as const satisfies Record<GuestMenuItemId, boolean>;

export const isGuestMenuItemId = (value: string): value is GuestMenuItemId =>
  GUEST_MENU_ITEM_IDS.includes(value as GuestMenuItemId);

export const getGuestMenuItemIdByModule = (module: GuestMenuModule): GuestMenuItemId =>
  GUEST_MENU_ITEM_IDS.find((id) => GUEST_MENU_MODULE_BY_ID[id] === module) ?? "review";

export const getDefaultGuestMenuItems = (): GuestMenuItem[] =>
  GUEST_MENU_ITEM_IDS.map((id) => ({
    enabled: DEFAULT_GUEST_MENU_ENABLED_BY_ID[id],
    id,
    module: GUEST_MENU_MODULE_BY_ID[id]
  }));
