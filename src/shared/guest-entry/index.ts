import {
  GUEST_MENU_MODULE_BY_ID,
  type GuestMenuItemId,
  type GuestMenuModule
} from "~/shared/guest-menu";
import type {
  ComplaintModuleSettings,
  ReviewModuleSettings,
  StaffModuleSettings,
  SuggestionModuleSettings
} from "~/shared/module-settings";
import type { StaffMemberItem } from "~/shared/staff";
import type { AppLocale } from "~/shared/i18n";
import type { GuestMenuSummary } from "~/shared/menu";

export const GUEST_ENTRY_CHANNEL_IDS = ["review", "complaint", "suggestion"] as const;

export type GuestEntryChannelId = (typeof GUEST_ENTRY_CHANNEL_IDS)[number];

export type GuestEntryChannelSettingsById = {
  complaint: ComplaintModuleSettings;
  review: ReviewModuleSettings;
  suggestion: SuggestionModuleSettings;
};

export type GuestEntryChannel = {
  [T in GuestEntryChannelId]: {
    id: T;
    module: (typeof GUEST_MENU_MODULE_BY_ID)[T];
    settings: GuestEntryChannelSettingsById[T];
  };
}[GuestEntryChannelId];

export type GuestEntryConfigPayload = {
  channels: GuestEntryChannel[];
  menu: GuestMenuSummary;
  organization: {
    description: string;
    id: string;
    locale: AppLocale;
    logoUrl?: string | null;
    name: string;
  };
  staff: {
    enabled: boolean;
    items: StaffMemberItem[];
    settings: StaffModuleSettings;
  };
  qrContext?: string;
  scanId?: null | string;
  startParam: string;
};

export const isGuestEntryChannelId = (value: GuestMenuItemId): value is GuestEntryChannelId =>
  GUEST_ENTRY_CHANNEL_IDS.includes(value as GuestEntryChannelId);

export const getGuestEntryChannelModule = <T extends GuestEntryChannelId>(
  channelId: T
): Extract<GuestMenuModule, (typeof GUEST_MENU_MODULE_BY_ID)[T]> =>
  GUEST_MENU_MODULE_BY_ID[channelId] as Extract<
    GuestMenuModule,
    (typeof GUEST_MENU_MODULE_BY_ID)[T]
  >;
