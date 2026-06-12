import type { OrganizationModule } from "../../../prisma/generated/prisma/client";

import { getOrganizationGuestContextByCode } from "~/server/domain/guest-contexts";
import { type DomainDb, getDomainDb } from "~/server/domain/shared";
import { parseGuestEntryStartParam } from "~/server/domain/guest-entry-payload";
import {
  GUEST_ENTRY_CHANNEL_IDS,
  type GuestEntryChannel,
  type GuestEntryConfigPayload
} from "~/shared/guest-entry";
import {
  DEFAULT_GUEST_MENU_ENABLED_BY_ID,
  GUEST_MENU_MODULE_BY_ID,
  type GuestMenuItemId
} from "~/shared/guest-menu";
import {
  getDefaultModuleSettings,
  parseModuleSettingsConfig,
  type ModuleSettingsById,
  type StaffModuleSettings
} from "~/shared/module-settings";
import type { StaffMemberItem } from "~/shared/staff";
import { isOrganizationSubscriptionActive } from "~/server/domain/subscriptions";
import { fromPrismaLocale } from "~/shared/i18n";

const toStaffMemberItem = (
  staffMember: {
    avatar_media_asset_id: null | string;
    display_name: string;
    id: string;
    is_active: boolean;
    role_title: string;
    sort_order: number;
  },
  avatarUrlByAssetId: Map<string, string> = new Map()
): StaffMemberItem => ({
  avatarMediaAssetId: staffMember.avatar_media_asset_id,
  avatarUrl: staffMember.avatar_media_asset_id
    ? (avatarUrlByAssetId.get(staffMember.avatar_media_asset_id) ?? null)
    : null,
  displayName: staffMember.display_name,
  id: staffMember.id,
  isActive: staffMember.is_active,
  roleTitle: staffMember.role_title,
  sortOrder: staffMember.sort_order
});

const getModuleEnabled = ({
  itemId,
  settingEnabled
}: {
  itemId: GuestMenuItemId;
  settingEnabled?: boolean;
}) => settingEnabled ?? DEFAULT_GUEST_MENU_ENABLED_BY_ID[itemId];

const getEffectiveStaff = ({
  enabled,
  items,
  settings
}: {
  enabled: boolean;
  items: StaffMemberItem[];
  settings: StaffModuleSettings;
}): GuestEntryConfigPayload["staff"] => {
  const activeItems = items.filter((item) => item.isActive);
  const guestSelectionEnabled = settings.guestSelectionEnabled && activeItems.length > 0;
  const allowTeamReview = settings.allowTeamReview;
  const effectiveEnabled = enabled && (guestSelectionEnabled || allowTeamReview);

  return {
    enabled: effectiveEnabled,
    items: effectiveEnabled && guestSelectionEnabled ? activeItems : [],
    settings: {
      allowTeamReview: effectiveEnabled && allowTeamReview,
      guestSelectionEnabled: effectiveEnabled && guestSelectionEnabled
    }
  };
};

const getAvatarUrlByAssetId = async (avatarMediaAssetIds: Array<null | string>, db: DomainDb) => {
  const ids = avatarMediaAssetIds.filter((value): value is string => Boolean(value));

  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const assets = await db.mediaAsset.findMany({
    select: {
      id: true,
      public_url: true
    },
    where: {
      id: {
        in: ids
      },
      kind: "STAFF_AVATAR",
      status: "READY"
    }
  });

  return new Map(assets.map((asset) => [asset.id, asset.public_url]));
};

export const getGuestEntryConfig = async (
  {
    startParam
  }: {
    startParam: string;
  },
  db: DomainDb = getDomainDb()
): Promise<GuestEntryConfigPayload> => {
  const guestEntryPayload = parseGuestEntryStartParam(startParam);

  const organization = await db.organization.findFirst({
    include: {
      module_settings: true,
      staff_members: {
        orderBy: [
          {
            sort_order: "asc"
          },
          {
            created_at: "asc"
          }
        ],
        where: {
          is_active: true
        }
      },
      subscription: true
    },
    where: {
      OR: [
        {
          id: guestEntryPayload.organizationRef
        },
        {
          slug: guestEntryPayload.organizationRef
        }
      ]
    }
  });

  if (!organization || organization.status !== "ACTIVE") {
    throw new Error("Organization is not available.");
  }

  const guestContext = guestEntryPayload.contextCode
    ? await getOrganizationGuestContextByCode(
        {
          code: guestEntryPayload.contextCode,
          organizationId: organization.id
        },
        db
      )
    : null;

  if (guestEntryPayload.contextCode && !guestContext) {
    throw new Error("Guest entry context is not available.");
  }

  if (
    organization.subscription !== undefined &&
    !isOrganizationSubscriptionActive(organization.subscription)
  ) {
    return {
      channels: [],
      organization: {
        description: organization.description,
        id: organization.id,
        locale: fromPrismaLocale(organization.locale),
        logoUrl: null,
        name: organization.name
      },
      staff: {
        enabled: false,
        items: [],
        settings: getDefaultModuleSettings("staff")
      },
      qrContext: guestContext?.label,
      startParam
    };
  }

  const settingsByModule = new Map(
    organization.module_settings.map((setting) => [setting.module, setting])
  );
  const logoAsset = organization.logo_media_asset_id
    ? await db.mediaAsset.findFirst({
        select: {
          public_url: true
        },
        where: {
          id: organization.logo_media_asset_id,
          kind: "ORGANIZATION_LOGO",
          status: "READY"
        }
      })
    : null;
  const channels = GUEST_ENTRY_CHANNEL_IDS.flatMap((itemId) => {
    const module = GUEST_MENU_MODULE_BY_ID[itemId] as OrganizationModule;
    const setting = settingsByModule.get(module);
    const enabled = getModuleEnabled({
      itemId,
      settingEnabled: setting?.enabled
    });

    if (!enabled) {
      return [];
    }

    return [
      {
        id: itemId,
        module: GUEST_MENU_MODULE_BY_ID[itemId],
        settings: parseModuleSettingsConfig({
          config: setting?.config,
          itemId
        }) as ModuleSettingsById[typeof itemId]
      } as GuestEntryChannel
    ];
  });
  const staffSetting = settingsByModule.get("STAFF");
  const staffEnabled = getModuleEnabled({
    itemId: "staff",
    settingEnabled: staffSetting?.enabled
  });
  const staffAvatarUrlByAssetId = await getAvatarUrlByAssetId(
    organization.staff_members.map((staffMember) => staffMember.avatar_media_asset_id),
    db
  );

  return {
    channels,
    organization: {
      description: organization.description,
      id: organization.id,
      locale: fromPrismaLocale(organization.locale),
      logoUrl: logoAsset?.public_url ?? null,
      name: organization.name
    },
    staff: getEffectiveStaff({
      enabled: staffEnabled,
      items: organization.staff_members.map((staffMember) =>
        toStaffMemberItem(staffMember, staffAvatarUrlByAssetId)
      ),
      settings: parseModuleSettingsConfig({
        config: staffSetting?.config,
        itemId: "staff"
      })
    }),
    qrContext: guestContext?.label,
    startParam
  };
};
