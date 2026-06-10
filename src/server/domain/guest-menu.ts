import type { OrganizationModule } from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import {
  GUEST_MENU_MODULE_BY_ID,
  getDefaultGuestMenuItems,
  getGuestMenuItemIdByModule,
  type GuestMenuItem,
  type GuestMenuItemId,
  type GuestMenuModule
} from "~/shared/guest-menu";

const guestMenuModules = Object.values(GUEST_MENU_MODULE_BY_ID) as OrganizationModule[];

const toGuestMenuItem = ({
  enabled,
  module
}: {
  enabled: boolean;
  module: GuestMenuModule;
}): GuestMenuItem => {
  const id = getGuestMenuItemIdByModule(module);

  return {
    enabled,
    id,
    module
  };
};

export const getOrganizationGuestMenu = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
) => {
  const organization = await db.organization.findUnique({
    include: {
      module_settings: {
        where: {
          module: {
            in: guestMenuModules
          }
        }
      }
    },
    where: {
      id: organizationId
    }
  });

  if (!organization || organization.status !== "ACTIVE") {
    throw new Error("Organization is not available.");
  }

  const enabledByModule = new Map(
    organization.module_settings.map((setting) => [setting.module, setting.enabled])
  );

  return {
    items: getDefaultGuestMenuItems().map((item) => ({
      ...item,
      enabled: enabledByModule.get(item.module as OrganizationModule) ?? item.enabled
    })),
    organizationId: organization.id
  };
};

export const updateOrganizationGuestMenuItem = async (
  {
    enabled,
    itemId,
    organizationId
  }: {
    enabled: boolean;
    itemId: GuestMenuItemId;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const organization = await db.organization.findUnique({
    select: {
      id: true,
      status: true
    },
    where: {
      id: organizationId
    }
  });

  if (!organization || organization.status !== "ACTIVE") {
    throw new Error("Organization is not available.");
  }

  const module = GUEST_MENU_MODULE_BY_ID[itemId] as OrganizationModule;
  const setting = await db.organizationModuleSetting.upsert({
    create: {
      enabled,
      module,
      organization_id: organization.id
    },
    update: {
      enabled
    },
    where: {
      organization_id_module: {
        module,
        organization_id: organization.id
      }
    }
  });

  return {
    item: toGuestMenuItem({
      enabled: setting.enabled,
      module: setting.module as GuestMenuModule
    }),
    organizationId: organization.id
  };
};
