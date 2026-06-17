import type {
  OrganizationSubscriptionStatus,
  SubmissionKind
} from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { isOrganizationSubscriptionActive } from "~/server/domain/subscriptions";
import { getMediaPublicUrl } from "~/server/media/public-url";
import {
  type SystemPulseOrganizationItem,
  type SystemPulsePayload,
  type SystemPulsePeriod,
  type SystemPulseSubmissionItem
} from "~/shared/system";

const dayMs = 86_400_000;
const recentSubmissionsLimit = 8;
const systemOrganizationsLimit = 12;
const activeSubscriptionStatuses: OrganizationSubscriptionStatus[] = [
  "TRIALING",
  "ACTIVE",
  "GRANTED"
];

const toIso = (date: Date | null | undefined) => date?.toISOString() ?? null;

const startOfDay = (date: Date) => {
  const next = new Date(date);

  next.setHours(0, 0, 0, 0);

  return next;
};

const getPeriodStart = (period: SystemPulsePeriod, now: Date) => {
  if (period === "ALL") return null;
  if (period === "TODAY") return startOfDay(now);

  const days = period === "7D" ? 7 : 30;

  return new Date(now.getTime() - (days - 1) * dayMs);
};

const getSinceWhere = (from: Date | null) =>
  from
    ? {
        created_at: {
          gte: from
        }
      }
    : {};

const mapCountGroups = (groups: Array<{ _count: { _all: number }; organization_id: string }>) =>
  new Map(groups.map((group) => [group.organization_id, group._count._all]));

const getPreview = (bodyText: string, kind: SubmissionKind) => {
  const normalized = bodyText.replace(/\s+/g, " ").trim();

  if (normalized) {
    return normalized.slice(0, 120);
  }

  if (kind === "REVIEW") return "Отзыв без текста";
  if (kind === "COMPLAINT") return "Жалоба без описания";

  return "Предложение без текста";
};

export const recordGuestEntryScan = async (
  {
    locale,
    organizationId,
    platform,
    qrContext,
    startParam,
    userId
  }: {
    locale?: string;
    organizationId: string;
    platform?: string;
    qrContext?: string;
    startParam: string;
    userId?: string;
  },
  db: DomainDb = getDomainDb()
) =>
  db.guestEntryScan.create({
    data: {
      locale: locale?.trim() || null,
      organization_id: organizationId,
      platform: platform?.trim() || null,
      qr_context: qrContext?.trim() || null,
      start_param: startParam,
      user_id: userId
    }
  });

export const getSystemPulse = async (
  {
    period
  }: {
    period: SystemPulsePeriod;
  },
  db: DomainDb = getDomainDb()
): Promise<SystemPulsePayload> => {
  const now = new Date();
  const from = getPeriodStart(period, now);
  const sinceWhere = getSinceWhere(from);
  const activeSubscriptionWhere = {
    OR: [
      {
        current_period_ends_at: null
      },
      {
        current_period_ends_at: {
          gt: now
        }
      }
    ],
    status: {
      in: activeSubscriptionStatuses
    }
  };
  const activeOrganizationWhere = {
    status: "ACTIVE" as const
  };
  const [
    usersTotal,
    usersValue,
    organizationsTotal,
    organizationsValue,
    submissionsTotal,
    submissionsValue,
    scansTotal,
    scansValue,
    activeSubscriptionsTotal,
    activeSubscriptionsValue,
    recentSubmissions,
    organizations
  ] = await Promise.all([
    db.user.count(),
    db.user.count({
      where: sinceWhere
    }),
    db.organization.count({
      where: activeOrganizationWhere
    }),
    db.organization.count({
      where: {
        ...activeOrganizationWhere,
        ...sinceWhere
      }
    }),
    db.submission.count(),
    db.submission.count({
      where: sinceWhere
    }),
    db.guestEntryScan.count(),
    db.guestEntryScan.count({
      where: sinceWhere
    }),
    db.organizationSubscription.count({
      where: activeSubscriptionWhere
    }),
    db.organizationSubscription.count({
      where: {
        ...activeSubscriptionWhere,
        ...sinceWhere
      }
    }),
    db.submission.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: {
        created_at: "desc"
      },
      take: recentSubmissionsLimit
    }),
    db.organization.findMany({
      include: {
        owner: {
          select: {
            first_name: true,
            id: true,
            last_name: true,
            telegram_id: true,
            username: true
          }
        },
        subscription: true
      },
      orderBy: {
        updated_at: "desc"
      },
      take: systemOrganizationsLimit,
      where: activeOrganizationWhere
    })
  ]);
  const organizationIds = organizations.map((organization) => organization.id);
  const [submissionGroups, scanGroups, logoAssets] = await Promise.all([
    organizationIds.length > 0
      ? db.submission.groupBy({
          _count: {
            _all: true
          },
          by: ["organization_id"],
          where: {
            organization_id: {
              in: organizationIds
            },
            ...sinceWhere
          }
        })
      : [],
    organizationIds.length > 0
      ? db.guestEntryScan.groupBy({
          _count: {
            _all: true
          },
          by: ["organization_id"],
          where: {
            organization_id: {
              in: organizationIds
            },
            ...sinceWhere
          }
        })
      : [],
    db.mediaAsset.findMany({
      select: {
        bucket: true,
        id: true,
        public_url: true,
        storage_key: true
      },
      where: {
        id: {
          in: organizations
            .map((organization) => organization.logo_media_asset_id)
            .filter((id): id is string => Boolean(id))
        },
        kind: "ORGANIZATION_LOGO",
        status: "READY"
      }
    })
  ]);
  const submissionCountByOrganizationId = mapCountGroups(submissionGroups);
  const scanCountByOrganizationId = mapCountGroups(scanGroups);
  const logoUrlByAssetId = new Map(logoAssets.map((asset) => [asset.id, getMediaPublicUrl(asset)]));
  const organizationItems = organizations.map<SystemPulseOrganizationItem>((organization) => ({
    createdAt: organization.created_at.toISOString(),
    id: organization.id,
    logoUrl: organization.logo_media_asset_id
      ? logoUrlByAssetId.get(organization.logo_media_asset_id)
      : undefined,
    name: organization.name,
    owner: {
      firstName: organization.owner.first_name,
      id: organization.owner.id,
      lastName: organization.owner.last_name,
      telegramId: organization.owner.telegram_id.toString(),
      username: organization.owner.username
    },
    scanCount: scanCountByOrganizationId.get(organization.id) ?? 0,
    slug: organization.slug,
    submissionCount: submissionCountByOrganizationId.get(organization.id) ?? 0,
    subscription: {
      currentPeriodEndsAt: toIso(organization.subscription?.current_period_ends_at),
      isActive: isOrganizationSubscriptionActive(organization.subscription),
      planCode: organization.subscription?.plan_code ?? null,
      source: organization.subscription?.source ?? null,
      status: organization.subscription?.status ?? null
    }
  }));
  const submissionItems = recentSubmissions.map<SystemPulseSubmissionItem>((submission) => ({
    createdAt: submission.created_at.toISOString(),
    id: submission.id,
    kind: submission.kind,
    organization: submission.organization,
    preview: getPreview(submission.body_text, submission.kind),
    qrContext: submission.qr_context,
    rating: submission.rating
  }));

  return {
    organizations: organizationItems,
    period,
    range: {
      from: toIso(from),
      to: now.toISOString()
    },
    recentSubmissions: submissionItems,
    totals: {
      activeSubscriptions: {
        total: activeSubscriptionsTotal,
        value: activeSubscriptionsValue
      },
      organizations: {
        total: organizationsTotal,
        value: organizationsValue
      },
      scans: {
        total: scansTotal,
        value: scansValue
      },
      submissions: {
        total: submissionsTotal,
        value: submissionsValue
      },
      users: {
        total: usersTotal,
        value: usersValue
      }
    }
  };
};
