import type {
  OrganizationSubscriptionStatus,
  Prisma,
  SubmissionKind
} from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { isOrganizationSubscriptionActive } from "~/server/domain/subscriptions";
import { toAdminSubmissionItem } from "~/server/domain/submissions";
import { getMediaPublicUrl } from "~/server/media/public-url";
import {
  type SystemOrganizationDetailPayload,
  type SystemOrganizationsPayload,
  type SystemAuditLogItem,
  type SystemPulseOrganizationItem,
  type SystemPulsePayload,
  type SystemPulsePeriod,
  type SystemPulseSubmissionItem,
  type SystemStarsPayload,
  type SystemStarsPaymentItem,
  type SystemSubmissionItem,
  type SystemSubmissionsPayload,
  type SystemUserDetailPayload,
  type SystemUserItem,
  type SystemUsersPayload
} from "~/shared/system";

const dayMs = 86_400_000;
const defaultSystemListLimit = 40;
const defaultSystemPageSize = 24;
const hubListLimit = 6;
const recentSubmissionsLimit = 6;
const activeSubscriptionStatuses: OrganizationSubscriptionStatus[] = [
  "TRIALING",
  "ACTIVE",
  "GRANTED"
];

const toIso = (date: Date | null | undefined) => date?.toISOString() ?? null;

const getTake = (limit?: number) =>
  Math.min(Math.max(Math.trunc(limit ?? defaultSystemPageSize) || defaultSystemPageSize, 1), 50);

const getNextCursor = <T extends { id: string }>(items: T[], take: number) => {
  const visibleItems = items.slice(0, take);

  return {
    items: visibleItems,
    nextCursor: items.length > take ? (visibleItems.at(-1)?.id ?? null) : null
  };
};

const toTrendMetric = ({ total, value, previous }: { previous: number; total: number; value: number }) => ({
  previous,
  total,
  trend: value > previous ? ("up" as const) : value < previous ? ("down" as const) : ("flat" as const),
  value
});

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

const getPreviousPeriodWhere = (period: SystemPulsePeriod, from: Date | null, now: Date) => {
  if (!from || period === "ALL") return null;

  const durationMs = now.getTime() - from.getTime();

  return {
    created_at: {
      gte: new Date(from.getTime() - durationMs),
      lt: from
    }
  };
};

const mapCountGroups = (groups: Array<{ _count: { _all: number }; organization_id: string }>) =>
  new Map(groups.map((group) => [group.organization_id, group._count._all]));

const mapUserCountGroups = (groups: Array<{ _count: { _all: number }; user_id: string | null }>) =>
  new Map(groups.flatMap((group) => (group.user_id ? [[group.user_id, group._count._all]] : [])));

const getPreview = (bodyText: string, kind: SubmissionKind) => {
  const normalized = bodyText.replace(/\s+/g, " ").trim();

  if (normalized) {
    return normalized.slice(0, 120);
  }

  return "";
};

const normalizeSearch = (search?: string) => search?.replace(/\s+/g, " ").trim() || "";

const createOrganizationSearchWhere = (search?: string): Prisma.OrganizationWhereInput => {
  const query = normalizeSearch(search);

  if (!query) return {};

  return {
    OR: [
      {
        id: query
      },
      {
        name: {
          contains: query,
          mode: "insensitive"
        }
      },
      {
        slug: {
          contains: query,
          mode: "insensitive"
        }
      },
      {
        owner: {
          id: query
        }
      },
      {
        owner: {
          username: {
            contains: query.replace(/^@/, ""),
            mode: "insensitive"
          }
        }
      },
      {
        owner: {
          first_name: {
            contains: query,
            mode: "insensitive"
          }
        }
      }
    ]
  };
};

const createUserSearchWhere = (search?: string): Prisma.UserWhereInput => {
  const query = normalizeSearch(search);

  if (!query) return {};

  const telegramId = /^\d+$/.test(query) ? BigInt(query) : null;

  return {
    OR: [
      ...(telegramId
        ? [
            {
              telegram_id: telegramId
            }
          ]
        : []),
      {
        username: {
          contains: query.replace(/^@/, ""),
          mode: "insensitive"
        }
      },
      {
        first_name: {
          contains: query,
          mode: "insensitive"
        }
      },
      {
        last_name: {
          contains: query,
          mode: "insensitive"
        }
      },
      {
        phone_number: {
          contains: query
        }
      }
    ]
  };
};

const createSubmissionSearchWhere = (search?: string): Prisma.SubmissionWhereInput => {
  const query = normalizeSearch(search);

  if (!query) return {};

  return {
    OR: [
      {
        body_text: {
          contains: query,
          mode: "insensitive"
        }
      },
      {
        qr_context: {
          contains: query,
          mode: "insensitive"
        }
      },
      {
        customer_contact_phone: {
          contains: query
        }
      },
      {
        customer_display_name: {
          contains: query,
          mode: "insensitive"
        }
      },
      {
        organization: {
          name: {
            contains: query,
            mode: "insensitive"
          }
        }
      }
    ]
  };
};

const getOrganizationItems = async ({
  cursor,
  db,
  limit = defaultSystemListLimit,
  period,
  search
}: {
  cursor?: string;
  db: DomainDb;
  limit?: number;
  period: SystemPulsePeriod;
  search?: string;
}) => {
  const now = new Date();
  const from = getPeriodStart(period, now);
  const sinceWhere = getSinceWhere(from);
  const take = getTake(limit);
  const where: Prisma.OrganizationWhereInput = {
    status: "ACTIVE",
    ...createOrganizationSearchWhere(search)
  };
  const shouldIncludeTotal = !cursor;
  const [total, organizations] = await Promise.all([
    shouldIncludeTotal ? db.organization.count({ where }) : Promise.resolve(0),
    db.organization.findMany({
      ...(cursor
        ? {
            cursor: {
              id: cursor
            },
            skip: 1
          }
        : {}),
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
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: take + 1,
      where
    })
  ]);
  const page = getNextCursor(organizations, take);
  const visibleOrganizations = page.items;
  const organizationIds = visibleOrganizations.map((organization) => organization.id);
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
          in: visibleOrganizations
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
  const items = visibleOrganizations.map<SystemPulseOrganizationItem>((organization) => ({
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

  return {
    items,
    nextCursor: page.nextCursor,
    total
  };
};

const includeSystemSubmission = {
  attachments: {
    include: {
      media_asset: {
        select: {
          bucket: true,
          public_url: true,
          storage_key: true
        }
      }
    },
    orderBy: {
      sort_order: "asc"
    },
    take: 4
  },
  organization: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  },
  customer_user: {
    select: {
      first_name: true,
      id: true,
      last_name: true,
      phone_number: true,
      photo_url: true,
      telegram_id: true,
      username: true
    }
  },
  target_staff_member: {
    select: {
      display_name: true,
      id: true,
      role_title: true
    }
  }
} satisfies Prisma.SubmissionInclude;

const toSystemSubmissionItem = (
  submission: Prisma.SubmissionGetPayload<{
    include: typeof includeSystemSubmission;
  }>
): SystemSubmissionItem => ({
  ...toAdminSubmissionItem(submission),
  customerUser: submission.customer_user
    ? {
        firstName: submission.customer_user.first_name,
        id: submission.customer_user.id,
        lastName: submission.customer_user.last_name,
        phoneNumber: submission.customer_user.phone_number,
        photoUrl: submission.customer_user.photo_url,
        telegramId: submission.customer_user.telegram_id.toString(),
        username: submission.customer_user.username
      }
    : null,
  organization: submission.organization
});

const toSystemAuditLogItem = (
  item: Prisma.SystemAuditLogGetPayload<{
    include: {
      actor_user: {
        select: {
          first_name: true;
          id: true;
          last_name: true;
          telegram_id: true;
          username: true;
        };
      };
    };
  }>
): SystemAuditLogItem => ({
  action: item.action,
  actor: item.actor_user
    ? {
        firstName: item.actor_user.first_name,
        id: item.actor_user.id,
        lastName: item.actor_user.last_name,
        telegramId: item.actor_user.telegram_id.toString(),
        username: item.actor_user.username
      }
    : null,
  createdAt: item.created_at.toISOString(),
  id: item.id,
  targetId: item.target_id,
  targetType: item.target_type
});

const toSystemStarsPaymentItem = (payment: {
  amount_stars: number;
  created_at: Date;
  currency: string;
  id: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  paid_at: Date | null;
  payer_user: null | {
    first_name: string;
    id: string;
    last_name: string | null;
    telegram_id: bigint;
    username: string | null;
  };
  plan_code: "ANNUAL" | "MONTHLY";
  status: "CANCELED" | "FAILED" | "PAID" | "REFUNDED";
  telegram_payment_charge_id: string | null;
}): SystemStarsPaymentItem => ({
  amountStars: payment.amount_stars,
  createdAt: payment.created_at.toISOString(),
  currency: payment.currency,
  id: payment.id,
  organization: payment.organization,
  paidAt: toIso(payment.paid_at),
  payer: payment.payer_user
    ? {
        firstName: payment.payer_user.first_name,
        id: payment.payer_user.id,
        lastName: payment.payer_user.last_name,
        telegramId: payment.payer_user.telegram_id.toString(),
        username: payment.payer_user.username
      }
    : null,
  planCode: payment.plan_code,
  status: payment.status,
  telegramPaymentChargeId: payment.telegram_payment_charge_id
});

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

export const recordSystemAuditLog = async (
  {
    action,
    actorUserId,
    metadata,
    targetId,
    targetType
  }: {
    action: string;
    actorUserId?: string;
    metadata?: Prisma.InputJsonValue;
    targetId?: string;
    targetType: string;
  },
  db: DomainDb = getDomainDb()
) =>
  db.systemAuditLog.create({
    data: {
      action,
      actor_user_id: actorUserId,
      metadata,
      target_id: targetId,
      target_type: targetType
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
  const previousWhere = getPreviousPeriodWhere(period, from, now);
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
    paidStarsTotal,
    paidStarsValue,
    usersPrevious,
    organizationsPrevious,
    submissionsPrevious,
    scansPrevious,
    activeSubscriptionsPrevious,
    paidStarsPrevious,
    recentSubmissions,
    organizationResult
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
    db.organizationSubscriptionPayment.aggregate({
      _sum: {
        amount_stars: true
      },
      where: {
        status: "PAID"
      }
    }),
    db.organizationSubscriptionPayment.aggregate({
      _sum: {
        amount_stars: true
      },
      where: {
        status: "PAID",
        ...sinceWhere
      }
    }),
    previousWhere
      ? db.user.count({
          where: previousWhere
        })
      : 0,
    previousWhere
      ? db.organization.count({
          where: {
            ...activeOrganizationWhere,
            ...previousWhere
          }
        })
      : 0,
    previousWhere
      ? db.submission.count({
          where: previousWhere
        })
      : 0,
    previousWhere
      ? db.guestEntryScan.count({
          where: previousWhere
        })
      : 0,
    previousWhere
      ? db.organizationSubscription.count({
          where: {
            ...activeSubscriptionWhere,
            ...previousWhere
          }
        })
      : 0,
    previousWhere
      ? db.organizationSubscriptionPayment.aggregate({
          _sum: {
            amount_stars: true
          },
          where: {
            status: "PAID",
            ...previousWhere
          }
        })
      : {
          _sum: {
            amount_stars: 0
          }
        },
    db.submission.findMany({
      include: {
        customer_user: {
          select: {
            first_name: true,
            id: true,
            last_name: true,
            phone_number: true,
            photo_url: true,
            telegram_id: true,
            username: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: recentSubmissionsLimit
    }),
    getOrganizationItems({
      db,
      limit: hubListLimit,
      period
    })
  ]);
  const submissionItems = recentSubmissions.map<SystemPulseSubmissionItem>((submission) => ({
    createdAt: submission.created_at.toISOString(),
    customerUser: submission.customer_user
      ? {
          firstName: submission.customer_user.first_name,
          id: submission.customer_user.id,
          lastName: submission.customer_user.last_name,
          phoneNumber: submission.customer_user.phone_number,
          photoUrl: submission.customer_user.photo_url,
          telegramId: submission.customer_user.telegram_id.toString(),
          username: submission.customer_user.username
        }
      : null,
    id: submission.id,
    kind: submission.kind,
    organization: submission.organization,
    preview: getPreview(submission.body_text, submission.kind),
    qrContext: submission.qr_context,
    rating: submission.rating
  }));

  return {
    organizations: organizationResult.items,
    period,
    range: {
      from: toIso(from),
      to: now.toISOString()
    },
    recentSubmissions: submissionItems,
    totals: {
      activeSubscriptions: toTrendMetric({
        previous: activeSubscriptionsPrevious,
        total: activeSubscriptionsTotal,
        value: activeSubscriptionsValue
      }),
      organizations: toTrendMetric({
        previous: organizationsPrevious,
        total: organizationsTotal,
        value: organizationsValue
      }),
      paidStars: toTrendMetric({
        previous: paidStarsPrevious._sum.amount_stars ?? 0,
        total: paidStarsTotal._sum.amount_stars ?? 0,
        value: paidStarsValue._sum.amount_stars ?? 0
      }),
      scans: toTrendMetric({
        previous: scansPrevious,
        total: scansTotal,
        value: scansValue
      }),
      submissions: toTrendMetric({
        previous: submissionsPrevious,
        total: submissionsTotal,
        value: submissionsValue
      }),
      users: toTrendMetric({
        previous: usersPrevious,
        total: usersTotal,
        value: usersValue
      })
    }
  };
};

export const getSystemOrganizations = async (
  {
    cursor,
    period,
    search
  }: {
    cursor?: string;
    period: SystemPulsePeriod;
    search?: string;
  },
  db: DomainDb = getDomainDb()
): Promise<SystemOrganizationsPayload> => {
  const result = await getOrganizationItems({
    cursor,
    db,
    period,
    search
  });

  return {
    ...result,
    period
  };
};

export const getSystemOrganizationDetail = async (
  {
    cursor,
    organizationId,
    period
  }: {
    cursor?: string;
    organizationId: string;
    period: SystemPulsePeriod;
  },
  db: DomainDb = getDomainDb()
): Promise<SystemOrganizationDetailPayload> => {
  const take = getTake();
  const organization = await db.organization.findFirst({
    select: {
      contact_text: true,
      description: true,
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

  const [organizationItems, submissions, auditLogs] = await Promise.all([
    getOrganizationItems({
      db,
      period,
      search: organization.id
    }),
    db.submission.findMany({
      ...(cursor
        ? {
            cursor: {
              id: cursor
            },
            skip: 1
          }
        : {}),
      include: includeSystemSubmission,
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: take + 1,
      where: {
        organization_id: organization.id
      }
    }),
    db.systemAuditLog.findMany({
      include: {
        actor_user: {
          select: {
            first_name: true,
            id: true,
            last_name: true,
            telegram_id: true,
            username: true
          }
        }
      },
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: 5,
      where: {
        target_id: organization.id,
        target_type: "ORGANIZATION"
      }
    })
  ]);
  const submissionsPage = getNextCursor(submissions, take);
  const item =
    organizationItems.items.find((nextItem) => nextItem.id === organization.id) ??
    (
      await getOrganizationItems({
        db,
        period
      })
    ).items.find((nextItem) => nextItem.id === organization.id);

  if (!item) {
    throw new Error("Organization is not available.");
  }

  return {
    auditLogs: auditLogs.map(toSystemAuditLogItem),
    organization: {
      ...item,
      contactText: organization.contact_text,
      description: organization.description
    },
    period,
    submissions: submissionsPage.items.map(toSystemSubmissionItem),
    submissionsNextCursor: submissionsPage.nextCursor
  };
};

export const getSystemUsers = async (
  {
    cursor,
    period,
    search
  }: {
    cursor?: string;
    period: SystemPulsePeriod;
    search?: string;
  },
  db: DomainDb = getDomainDb()
): Promise<SystemUsersPayload> => {
  const now = new Date();
  const from = getPeriodStart(period, now);
  const sinceWhere = getSinceWhere(from);
  const take = getTake();
  const where = createUserSearchWhere(search);
  const shouldIncludeTotal = !cursor;
  const [total, users] = await Promise.all([
    shouldIncludeTotal ? db.user.count({ where }) : Promise.resolve(0),
    db.user.findMany({
      ...(cursor
        ? {
            cursor: {
              id: cursor
            },
            skip: 1
          }
        : {}),
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: take + 1,
      where
    })
  ]);
  const page = getNextCursor(users, take);
  const visibleUsers = page.items;
  const userIds = visibleUsers.map((user) => user.id);
  const [organizationGroups, submissionGroups, scanGroups] = await Promise.all([
    userIds.length > 0
      ? db.organization.groupBy({
          _count: {
            _all: true
          },
          by: ["owner_user_id"],
          where: {
            owner_user_id: {
              in: userIds
            },
            status: "ACTIVE"
          }
        })
      : [],
    userIds.length > 0
      ? db.submission.groupBy({
          _count: {
            _all: true
          },
          by: ["customer_user_id"],
          where: {
            customer_user_id: {
              in: userIds
            },
            ...sinceWhere
          }
        })
      : [],
    userIds.length > 0
      ? db.guestEntryScan.groupBy({
          _count: {
            _all: true
          },
          by: ["user_id"],
          where: {
            user_id: {
              in: userIds
            },
            ...sinceWhere
          }
        })
      : []
  ]);
  const organizationCountByUserId = new Map(
    organizationGroups.map((group) => [group.owner_user_id, group._count._all])
  );
  const submissionCountByUserId = new Map(
    submissionGroups.flatMap((group) =>
      group.customer_user_id ? [[group.customer_user_id, group._count._all]] : []
    )
  );
  const scanCountByUserId = mapUserCountGroups(scanGroups);
  const items = visibleUsers.map<SystemUserItem>((user) => ({
    createdAt: user.created_at.toISOString(),
    firstName: user.first_name,
    id: user.id,
    languageCode: user.language_code,
    lastName: user.last_name,
    locale: user.locale,
    organizationCount: organizationCountByUserId.get(user.id) ?? 0,
    phoneNumber: user.phone_number,
    photoUrl: user.photo_url,
    scanCount: scanCountByUserId.get(user.id) ?? 0,
    submissionCount: submissionCountByUserId.get(user.id) ?? 0,
    telegramId: user.telegram_id.toString(),
    username: user.username
  }));

  return {
    items,
    nextCursor: page.nextCursor,
    period,
    total
  };
};

export const getSystemUserDetail = async (
  {
    cursor,
    userId
  }: {
    cursor?: string;
    userId: string;
  },
  db: DomainDb = getDomainDb()
): Promise<SystemUserDetailPayload> => {
  const take = getTake();
  const user = await db.user.findUnique({
    where: {
      id: userId
    }
  });

  if (!user) {
    throw new Error("User is not available.");
  }

  const [
    organizationCount,
    submissionCount,
    scanCount,
    organizationResult,
    submissions,
    stars,
    auditLogs
  ] = await Promise.all([
    db.organization.count({
      where: {
        owner_user_id: user.id,
        status: "ACTIVE"
      }
    }),
    db.submission.count({
      where: {
        customer_user_id: user.id
      }
    }),
    db.guestEntryScan.count({
      where: {
        user_id: user.id
      }
    }),
    getOrganizationItems({
      db,
      limit: 8,
      period: "ALL",
      search: user.id
    }),
    db.submission.findMany({
      ...(cursor
        ? {
            cursor: {
              id: cursor
            },
            skip: 1
          }
        : {}),
      include: includeSystemSubmission,
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: take + 1,
      where: {
        customer_user_id: user.id
      }
    }),
    db.organizationSubscriptionPayment.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        payer_user: {
          select: {
            first_name: true,
            id: true,
            last_name: true,
            telegram_id: true,
            username: true
          }
        }
      },
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: 8,
      where: {
        payer_user_id: user.id
      }
    }),
    db.systemAuditLog.findMany({
      include: {
        actor_user: {
          select: {
            first_name: true,
            id: true,
            last_name: true,
            telegram_id: true,
            username: true
          }
        }
      },
      orderBy: {
        created_at: "desc"
      },
      take: 8,
      where: {
        OR: [
          {
            actor_user_id: user.id
          },
          {
            target_id: user.id,
            target_type: "USER"
          }
        ]
      }
    })
  ]);
  const submissionsPage = getNextCursor(submissions, take);

  return {
    auditLogs: auditLogs.map(toSystemAuditLogItem),
    organizations: organizationResult.items,
    stars: stars.map(toSystemStarsPaymentItem),
    submissions: submissionsPage.items.map(toSystemSubmissionItem),
    submissionsNextCursor: submissionsPage.nextCursor,
    user: {
      createdAt: user.created_at.toISOString(),
      firstName: user.first_name,
      id: user.id,
      languageCode: user.language_code,
      lastName: user.last_name,
      locale: user.locale,
      organizationCount,
      phoneNumber: user.phone_number,
      photoUrl: user.photo_url,
      scanCount,
      submissionCount,
      telegramId: user.telegram_id.toString(),
      username: user.username
    }
  };
};

export const getSystemSubmissions = async (
  {
    cursor,
    kind,
    period,
    search
  }: {
    cursor?: string;
    kind?: SubmissionKind;
    period: SystemPulsePeriod;
    search?: string;
  },
  db: DomainDb = getDomainDb()
): Promise<SystemSubmissionsPayload> => {
  const now = new Date();
  const from = getPeriodStart(period, now);
  const take = getTake();
  const where: Prisma.SubmissionWhereInput = {
    ...(kind ? { kind } : {}),
    ...getSinceWhere(from),
    ...createSubmissionSearchWhere(search)
  };
  const shouldIncludeTotal = !cursor;
  const [total, submissions] = await Promise.all([
    shouldIncludeTotal ? db.submission.count({ where }) : Promise.resolve(0),
    db.submission.findMany({
      ...(cursor
        ? {
            cursor: {
              id: cursor
            },
            skip: 1
          }
        : {}),
      include: includeSystemSubmission,
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: take + 1,
      where
    })
  ]);
  const page = getNextCursor(submissions, take);

  return {
    items: page.items.map(toSystemSubmissionItem),
    nextCursor: page.nextCursor,
    period,
    total
  };
};

export const getSystemStars = async (
  {
    cursor,
    period,
    search
  }: {
    cursor?: string;
    period: SystemPulsePeriod;
    search?: string;
  },
  db: DomainDb = getDomainDb()
): Promise<SystemStarsPayload> => {
  const now = new Date();
  const from = getPeriodStart(period, now);
  const take = getTake();
  const query = normalizeSearch(search);
  const where: Prisma.OrganizationSubscriptionPaymentWhereInput = {
    ...getSinceWhere(from),
    ...(query
      ? {
          OR: [
            {
              organization: {
                name: {
                  contains: query,
                  mode: "insensitive"
                }
              }
            },
            {
              payer_user: {
                username: {
                  contains: query.replace(/^@/, ""),
                  mode: "insensitive"
                }
              }
            },
            {
              telegram_payment_charge_id: {
                contains: query,
                mode: "insensitive"
              }
            }
          ]
        }
      : {})
  };
  const shouldIncludeTotals = !cursor;
  const [paidStars, paidPayments, refundedPayments, payments] = await Promise.all([
    shouldIncludeTotals
      ? db.organizationSubscriptionPayment.aggregate({
          _sum: {
            amount_stars: true
          },
          where: {
            ...where,
            status: "PAID"
          }
        })
      : Promise.resolve({
          _sum: {
            amount_stars: 0
          }
        }),
    shouldIncludeTotals
      ? db.organizationSubscriptionPayment.count({
          where: {
            ...where,
            status: "PAID"
          }
        })
      : Promise.resolve(0),
    shouldIncludeTotals
      ? db.organizationSubscriptionPayment.count({
          where: {
            ...where,
            status: "REFUNDED"
          }
        })
      : Promise.resolve(0),
    db.organizationSubscriptionPayment.findMany({
      ...(cursor
        ? {
            cursor: {
              id: cursor
            },
            skip: 1
          }
        : {}),
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        payer_user: {
          select: {
            first_name: true,
            id: true,
            last_name: true,
            telegram_id: true,
            username: true
          }
        }
      },
      orderBy: [
        {
          created_at: "desc"
        },
        {
          id: "desc"
        }
      ],
      take: take + 1,
      where
    })
  ]);
  const page = getNextCursor(payments, take);

  return {
    items: page.items.map(toSystemStarsPaymentItem),
    nextCursor: page.nextCursor,
    period,
    totals: {
      paidPayments,
      paidStars: paidStars._sum.amount_stars ?? 0,
      refundedPayments
    }
  };
};
