import type { Prisma, PrismaClient } from "../../../prisma/generated/prisma/client";

import { type DomainDb, getDomainDb } from "~/server/domain/shared";
import {
  createInitialOrganizationSubscriptionData,
  isOrganizationSubscriptionActive
} from "~/server/domain/subscriptions";
import { MAX_ADMIN_ORGANIZATIONS, type AdminOrganization } from "~/shared/admin/organizations";
import {
  DEFAULT_ORGANIZATION_PRESET_ID,
  getOrganizationPresetItems,
  type OrganizationPresetId
} from "~/shared/organization-presets";
import { createReadableSlug } from "~/shared/slug";
import { normalizeTimeZone } from "~/shared/time-zone";
import { fromPrismaLocale, type AppLocale } from "~/shared/i18n";

const toAdminOrganization = ({
  logoUrl,
  organization,
  role
}: {
  logoUrl?: string;
  organization: {
    contact_text: string;
    description: string;
    id: string;
    locale: string;
    name: string;
    slug: string;
    subscription?: Parameters<typeof isOrganizationSubscriptionActive>[0];
  };
  role: AdminOrganization["role"];
}): AdminOrganization => ({
  contactText: organization.contact_text,
  description: organization.description,
  id: organization.id,
  locale: fromPrismaLocale(organization.locale),
  logoUrl,
  name: organization.name,
  role,
  slug: organization.slug,
  subscriptionActive: isOrganizationSubscriptionActive(organization.subscription)
});

export const getOrganizationSlugBase = (name: string) => {
  const slug = createReadableSlug(name);

  return slug || `org-${Date.now().toString(36)}`;
};

const getUniqueOrganizationSlug = async (name: string, db: DomainDb) => {
  const base = getOrganizationSlugBase(name);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existingOrganization = await db.organization.findUnique({
      select: {
        id: true
      },
      where: {
        slug
      }
    });

    if (!existingOrganization) {
      return slug;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
};

export const getAdminOrganizations = async (userId: string, db: DomainDb = getDomainDb()) => {
  const organizations = await db.organization.findMany({
    include: {
      subscription: true
    },
    orderBy: {
      created_at: "asc"
    },
    where: {
      owner_user_id: userId,
      status: "ACTIVE"
    }
  });
  const logoAssetIds = Array.from(
    new Set(
      organizations
        .map((organization) => organization.logo_media_asset_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const logoAssets =
    logoAssetIds.length > 0
      ? await db.mediaAsset.findMany({
          select: {
            id: true,
            public_url: true
          },
          where: {
            id: {
              in: logoAssetIds
            },
            kind: "ORGANIZATION_LOGO",
            status: "READY"
          }
        })
      : [];
  const logoUrlByAssetId = new Map(logoAssets.map((asset) => [asset.id, asset.public_url]));

  const items = organizations.map<AdminOrganization>((organization) =>
    toAdminOrganization({
      logoUrl: organization.logo_media_asset_id
        ? logoUrlByAssetId.get(organization.logo_media_asset_id)
        : undefined,
      organization,
      role: "OWNER"
    })
  );

  return {
    activeOrganizationId: items[0]?.id ?? null,
    organizations: items
  };
};

export const createAdminOrganization = async (
  {
    contactText,
    locale,
    name,
    ownerUserId,
    presetId = DEFAULT_ORGANIZATION_PRESET_ID,
    timeZone
  }: {
    contactText?: string;
    locale: AppLocale;
    name: string;
    ownerUserId: string;
    presetId?: OrganizationPresetId;
    timeZone?: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const cleanName = name.trim();
  const cleanContactText = contactText?.trim() ?? "";
  const organizationTimeZone = normalizeTimeZone(timeZone);
  const activeOrganizationsCount = await db.organization.count({
    where: {
      owner_user_id: ownerUserId,
      status: "ACTIVE"
    }
  });

  if (activeOrganizationsCount >= MAX_ADMIN_ORGANIZATIONS) {
    throw new Error("Organization limit reached.");
  }

  const slug = await getUniqueOrganizationSlug(cleanName, db);
  const subscriptionStartedAt = new Date();

  const organization = await db.organization.create({
    include: {
      subscription: true
    },
    data: {
      contact_text: cleanContactText,
      locale,
      module_settings: {
        create: getOrganizationPresetItems(presetId).map((item) => ({
          config: item.settings as Prisma.InputJsonObject,
          enabled: item.enabled,
          module: item.module
        }))
      },
      name: cleanName,
      notification_targets: {
        create: {
          recipient_user_id: ownerUserId,
          type: "OWNER_DM"
        }
      },
      owner_user_id: ownerUserId,
      slug,
      subscription: {
        create: createInitialOrganizationSubscriptionData(subscriptionStartedAt)
      },
      time_zone: organizationTimeZone
    }
  });

  if (organization.subscription) {
    await db.organizationSubscriptionEvent.create({
      data: {
        organization_id: organization.id,
        subscription_id: organization.subscription.id,
        type: "TRIAL_STARTED"
      }
    });
  }

  const item = toAdminOrganization({
    organization,
    role: "OWNER"
  });

  return {
    activeOrganizationId: item.id,
    organization: item
  };
};

export const updateAdminOrganizationLogo = async (
  {
    logoMediaAssetId,
    organizationId,
    userId
  }: {
    logoMediaAssetId: string;
    organizationId: string;
    userId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const organization = await db.organization.findFirst({
    where: {
      id: organizationId,
      owner_user_id: userId,
      status: "ACTIVE"
    }
  });

  if (!organization) {
    throw new Error("Organization is not available.");
  }

  const logoAsset = await db.mediaAsset.findFirst({
    select: {
      id: true,
      public_url: true
    },
    where: {
      id: logoMediaAssetId,
      kind: "ORGANIZATION_LOGO",
      owner_id: organization.id,
      owner_type: "ORGANIZATION",
      status: "READY"
    }
  });

  if (!logoAsset) {
    throw new Error("Organization logo is not available.");
  }

  const updatedOrganization = await db.organization.update({
    include: {
      subscription: true
    },
    data: {
      logo_media_asset_id: logoAsset.id
    },
    where: {
      id: organization.id
    }
  });
  return {
    organization: toAdminOrganization({
      logoUrl: logoAsset.public_url,
      organization: updatedOrganization,
      role: "OWNER"
    })
  };
};

export const enqueueAdminOrganizationDeletion = async (
  {
    organizationId,
    requestedByUserId
  }: {
    organizationId: string;
    requestedByUserId?: string;
  },
  db: PrismaClient = getDomainDb() as PrismaClient
) => {
  const organization = await db.organization.findFirst({
    select: {
      id: true,
      name: true,
      slug: true
    },
    where: {
      id: organizationId,
      status: "ACTIVE"
    }
  });

  if (!organization) {
    throw new Error("Organization is not available.");
  }

  const job = await db.$transaction(async (tx) => {
    await tx.organization.update({
      data: {
        status: "DELETING"
      },
      where: {
        id: organization.id
      }
    });

    return tx.organizationDeletionJob.create({
      data: {
        organization_id: organization.id,
        organization_name: organization.name,
        organization_slug: organization.slug,
        requested_by_user_id: requestedByUserId
      }
    });
  });

  return {
    jobId: job.id,
    ok: true
  };
};
