import type { OrganizationModule, Prisma } from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { GUEST_MENU_MODULE_BY_ID, type GuestMenuItemId } from "~/shared/guest-menu";
import {
  getDefaultModuleSettings,
  mergeModuleSettings,
  parseModuleSettingsConfig,
  type ModuleSettingsPayload
} from "~/shared/module-settings";

const getModule = (itemId: GuestMenuItemId) =>
  GUEST_MENU_MODULE_BY_ID[itemId] as OrganizationModule;

const assertActiveOrganization = async (organizationId: string, db: DomainDb) => {
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

  return organization;
};

const getDefaultModuleEnabled = (itemId: GuestMenuItemId) => itemId !== "staff";

export const getOrganizationModuleSettings = async <T extends GuestMenuItemId>(
  {
    itemId,
    organizationId
  }: {
    itemId: T;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
): Promise<ModuleSettingsPayload<T>> => {
  await assertActiveOrganization(organizationId, db);

  const module = getModule(itemId);
  const setting = await db.organizationModuleSetting.findUnique({
    where: {
      organization_id_module: {
        module,
        organization_id: organizationId
      }
    }
  });

  return {
    enabled: setting?.enabled ?? getDefaultModuleEnabled(itemId),
    itemId,
    module: GUEST_MENU_MODULE_BY_ID[itemId],
    organizationId,
    settings: parseModuleSettingsConfig({
      config: setting?.config,
      itemId
    })
  };
};

export const updateOrganizationModuleSettings = async <T extends GuestMenuItemId>(
  {
    itemId,
    organizationId,
    patch
  }: {
    itemId: T;
    organizationId: string;
    patch: unknown;
  },
  db: DomainDb = getDomainDb()
): Promise<ModuleSettingsPayload<T>> => {
  await assertActiveOrganization(organizationId, db);

  const module = getModule(itemId);
  const currentSetting = await db.organizationModuleSetting.findUnique({
    where: {
      organization_id_module: {
        module,
        organization_id: organizationId
      }
    }
  });
  const settings = mergeModuleSettings({
    current: currentSetting?.config,
    itemId,
    patch
  });
  const setting = await db.organizationModuleSetting.upsert({
    create: {
      config: settings as Prisma.InputJsonObject,
      enabled: getDefaultModuleEnabled(itemId),
      module,
      organization_id: organizationId
    },
    update: {
      config: settings as Prisma.InputJsonObject
    },
    where: {
      organization_id_module: {
        module,
        organization_id: organizationId
      }
    }
  });

  return {
    enabled: setting.enabled,
    itemId,
    module: GUEST_MENU_MODULE_BY_ID[itemId],
    organizationId,
    settings
  };
};
