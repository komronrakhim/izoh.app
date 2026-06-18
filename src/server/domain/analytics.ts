import type { Prisma, SubmissionKind } from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { DEFAULT_GUEST_MENU_ENABLED_BY_ID } from "~/shared/guest-menu";
import {
  getAdminAnalyticsPeriodDays,
  isAdminAnalyticsPeriod,
  type AdminAnalyticsBreakdownItem,
  type AdminAnalyticsContextItem,
  type AdminAnalyticsCountSet,
  type AdminAnalyticsDayItem,
  type AdminAnalyticsPayload,
  type AdminAnalyticsPeriod,
  type AdminAnalyticsRatingDistribution,
  type AdminAnalyticsStaffItem,
  type AdminAnalyticsWeekdayItem
} from "~/shared/analytics";
import { safeParseSubmissionMetadata } from "~/shared/submissions";
import { normalizeTimeZone } from "~/shared/time-zone";

type AnalyticsSubmission = {
  attachments: Array<{
    id: string;
  }>;
  body_text: string;
  created_at: Date;
  customer_contact_phone: null | string;
  kind: SubmissionKind;
  metadata: unknown;
  qr_context: null | string;
  rating: null | number;
  target_staff_member: null | {
    display_name: string;
    id: string;
    role_title: string;
  };
};

type AnalyticsStaffAccumulator = AdminAnalyticsStaffItem;

const dayMs = 86_400_000;

const emptyCounts = (): AdminAnalyticsCountSet => ({
  ALL: 0,
  COMPLAINT: 0,
  REVIEW: 0,
  SUGGESTION: 0
});

const emptyDistribution = (): AdminAnalyticsRatingDistribution => ({
  "1": 0,
  "2": 0,
  "3": 0,
  "4": 0,
  "5": 0
});

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * dayMs);

const padDatePart = (value: number) => String(value).padStart(2, "0");

const getZonedDateParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(valueByType.get("day")),
    hour: Number(valueByType.get("hour")),
    minute: Number(valueByType.get("minute")),
    month: Number(valueByType.get("month")),
    second: Number(valueByType.get("second")),
    year: Number(valueByType.get("year"))
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = getZonedDateParts(date, timeZone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return zonedAsUtc - date.getTime();
};

const zonedDateTimeToUtc = (
  {
    day,
    hour = 0,
    minute = 0,
    month,
    second = 0,
    year
  }: {
    day: number;
    hour?: number;
    minute?: number;
    month: number;
    second?: number;
    year: number;
  },
  timeZone: string
) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const firstOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  const firstResult = new Date(utcGuess.getTime() - firstOffset);
  const correctedOffset = getTimeZoneOffsetMs(firstResult, timeZone);

  return new Date(utcGuess.getTime() - correctedOffset);
};

const startOfZonedDay = (date: Date, timeZone: string) => {
  const parts = getZonedDateParts(date, timeZone);

  return zonedDateTimeToUtc(
    {
      day: parts.day,
      month: parts.month,
      year: parts.year
    },
    timeZone
  );
};

const getTrendDirection = (current: number, previous: number) => {
  if (current > previous) return "up";
  if (current < previous) return "down";

  return "flat";
};

const getDateKey = (date: Date, timeZone: string) => {
  const parts = getZonedDateParts(date, timeZone);

  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
};

const getZonedWeekday = (date: Date, timeZone: string) => {
  const parts = getZonedDateParts(date, timeZone);

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
};

const getZonedHour = (date: Date, timeZone: string) => getZonedDateParts(date, timeZone).hour;

const incrementCount = (counts: AdminAnalyticsCountSet, kind: SubmissionKind) => {
  counts.ALL += 1;
  counts[kind] += 1;
};

const incrementBreakdown = (map: Map<string, number>, id: string) => {
  map.set(id, (map.get(id) ?? 0) + 1);
};

const toTopBreakdown = (map: Map<string, number>, limit = 7): AdminAnalyticsBreakdownItem[] =>
  Array.from(map.entries())
    .map(([id, count]) => ({
      count,
      id
    }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit);

const normalizeRatingKey = (rating: number) =>
  String(Math.max(1, Math.min(5, Math.round(rating)))) as keyof AdminAnalyticsRatingDistribution;

const getStaffTarget = (submission: AnalyticsSubmission) => {
  const metadata = safeParseSubmissionMetadata(submission.metadata);

  if (metadata.staffTargetSnapshot) {
    return {
      displayName: metadata.staffTargetSnapshot.displayName,
      id: metadata.staffTargetSnapshot.id,
      roleTitle: metadata.staffTargetSnapshot.roleTitle ?? "",
      type: "employee" as const
    };
  }

  if (submission.target_staff_member) {
    return {
      displayName: submission.target_staff_member.display_name,
      id: submission.target_staff_member.id,
      roleTitle: submission.target_staff_member.role_title,
      type: "employee" as const
    };
  }

  if (metadata.staffTargetType === "team") {
    return {
      type: "team" as const
    };
  }

  if (metadata.staffTargetType === "unknown") {
    return {
      type: "unknown" as const
    };
  }

  return {
    type: "none" as const
  };
};

const isPositiveReview = (submission: AnalyticsSubmission) =>
  submission.kind === "REVIEW" && typeof submission.rating === "number" && submission.rating >= 4;

const isLowReview = (submission: AnalyticsSubmission) =>
  submission.kind === "REVIEW" && typeof submission.rating === "number" && submission.rating <= 2;

const createDailyItems = ({
  from,
  periodDays,
  timeZone
}: {
  from: Date;
  periodDays: number;
  timeZone: string;
}): AdminAnalyticsDayItem[] =>
  Array.from(
    {
      length: periodDays
    },
    (_, index) => ({
      ...emptyCounts(),
      date: getDateKey(addDays(from, index), timeZone)
    })
  );

const createWeekdayItems = (): AdminAnalyticsWeekdayItem[] =>
  Array.from(
    {
      length: 7
    },
    (_, day) => ({
      count: 0,
      day
    })
  );

const buildAnalyticsPayload = ({
  currentRows,
  from,
  organizationId,
  period,
  previousFrom,
  previousRows,
  previousTo,
  staffEnabled,
  timeZone,
  to
}: {
  currentRows: AnalyticsSubmission[];
  from: Date;
  organizationId: string;
  period: AdminAnalyticsPeriod;
  previousFrom: Date;
  previousRows: AnalyticsSubmission[];
  previousTo: Date;
  staffEnabled: boolean;
  timeZone: string;
  to: Date;
}): AdminAnalyticsPayload => {
  const periodDays = getAdminAnalyticsPeriodDays(period);
  const counts = emptyCounts();
  const previousCounts = emptyCounts();
  const distribution = emptyDistribution();
  const daily = createDailyItems({
    from,
    periodDays,
    timeZone
  });
  const dailyByDate = new Map(daily.map((item) => [item.date, item]));
  const weekdays = createWeekdayItems();
  const hourCounts = new Map<number, number>();
  const complaintTopics = new Map<string, number>();
  const suggestionTopics = new Map<string, number>();
  const contexts = new Map<string, AdminAnalyticsContextItem>();
  const staffItems = new Map<string, AnalyticsStaffAccumulator>();
  const team = {
    complaintCount: 0,
    mentionsCount: 0,
    thanksCount: 0
  };
  let unknownMentionsCount = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let previousRatingSum = 0;
  let previousRatingCount = 0;
  let withText = 0;
  let withPhotos = 0;
  let withContact = 0;

  for (const submission of previousRows) {
    incrementCount(previousCounts, submission.kind);

    if (typeof submission.rating === "number") {
      previousRatingSum += submission.rating;
      previousRatingCount += 1;
    }
  }

  for (const submission of currentRows) {
    const metadata = safeParseSubmissionMetadata(submission.metadata);

    incrementCount(counts, submission.kind);

    if (submission.body_text.trim()) {
      withText += 1;
    }

    if (submission.attachments.length > 0) {
      withPhotos += 1;
    }

    if (submission.customer_contact_phone?.trim()) {
      withContact += 1;
    }

    if (typeof submission.rating === "number") {
      const ratingKey = normalizeRatingKey(submission.rating);

      distribution[ratingKey] += 1;
      ratingSum += submission.rating;
      ratingCount += 1;
    }

    if (submission.kind === "COMPLAINT") {
      for (const id of metadata.complaintCategoryIds ?? []) {
        incrementBreakdown(complaintTopics, id);
      }
    }

    if (submission.kind === "SUGGESTION") {
      for (const id of metadata.suggestionTopicIds ?? []) {
        incrementBreakdown(suggestionTopics, id);
      }
    }

    if (submission.qr_context?.trim()) {
      const label = submission.qr_context.trim();
      const currentContext = contexts.get(label) ?? {
        complaintCount: 0,
        count: 0,
        label,
        lowReviewCount: 0
      };

      currentContext.count += 1;
      currentContext.complaintCount += submission.kind === "COMPLAINT" ? 1 : 0;
      currentContext.lowReviewCount += isLowReview(submission) ? 1 : 0;
      contexts.set(label, currentContext);
    }

    if (staffEnabled) {
      const staffTarget = getStaffTarget(submission);

      if (staffTarget.type === "employee") {
        const item = staffItems.get(staffTarget.id) ?? {
          complaintCount: 0,
          displayName: staffTarget.displayName,
          id: staffTarget.id,
          lowReviewCount: 0,
          mentionsCount: 0,
          roleTitle: staffTarget.roleTitle,
          thanksCount: 0
        };

        item.mentionsCount += 1;
        item.thanksCount += isPositiveReview(submission) ? 1 : 0;
        item.complaintCount += submission.kind === "COMPLAINT" ? 1 : 0;
        item.lowReviewCount += isLowReview(submission) ? 1 : 0;
        staffItems.set(staffTarget.id, item);
      }

      if (staffTarget.type === "team") {
        team.mentionsCount += 1;
        team.thanksCount += isPositiveReview(submission) ? 1 : 0;
        team.complaintCount += submission.kind === "COMPLAINT" ? 1 : 0;
      }

      if (staffTarget.type === "unknown") {
        unknownMentionsCount += 1;
      }
    }

    const dateKey = getDateKey(submission.created_at, timeZone);
    const dailyItem = dailyByDate.get(dateKey);

    if (dailyItem) {
      incrementCount(dailyItem, submission.kind);
    }

    const weekday = getZonedWeekday(submission.created_at, timeZone);
    const weekdayItem = weekdays[weekday];

    if (weekdayItem) {
      weekdayItem.count += 1;
    }

    const hour = getZonedHour(submission.created_at, timeZone);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  const peakHour =
    Array.from(hourCounts.entries())
      .map(([hour, count]) => ({
        count,
        hour
      }))
      .sort((a, b) => b.count - a.count || a.hour - b.hour)[0] ?? null;

  return {
    contexts: Array.from(contexts.values())
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 8),
    engagement: {
      withContact,
      withPhotos,
      withText
    },
    organizationId,
    period,
    range: {
      from: from.toISOString(),
      previousFrom: previousFrom.toISOString(),
      previousTo: previousTo.toISOString(),
      timeZone,
      to: to.toISOString()
    },
    rating: {
      average: ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : null,
      distribution,
      negativeCount: distribution["1"] + distribution["2"],
      neutralCount: distribution["3"],
      positiveCount: distribution["4"] + distribution["5"],
      previousAverage:
        previousRatingCount > 0
          ? Number((previousRatingSum / previousRatingCount).toFixed(1))
          : null
    },
    staff: {
      enabled: staffEnabled,
      items: Array.from(staffItems.values())
        .sort(
          (a, b) =>
            b.thanksCount - a.thanksCount ||
            b.mentionsCount - a.mentionsCount ||
            a.displayName.localeCompare(b.displayName)
        )
        .slice(0, 12),
      team,
      unknownMentionsCount
    },
    time: {
      daily,
      peakHour,
      weekdays
    },
    topics: {
      complaint: toTopBreakdown(complaintTopics),
      suggestion: toTopBreakdown(suggestionTopics)
    },
    totals: {
      counts,
      trend: {
        current: counts.ALL,
        direction: getTrendDirection(counts.ALL, previousCounts.ALL),
        previous: previousCounts.ALL
      }
    }
  };
};

export const getOrganizationAnalytics = async (
  {
    now = new Date(),
    organizationId,
    period = "30D",
    timeZone
  }: {
    now?: Date;
    organizationId: string;
    period?: AdminAnalyticsPeriod | string;
    timeZone?: string;
  },
  db: DomainDb = getDomainDb()
): Promise<AdminAnalyticsPayload> => {
  const parsedPeriod = isAdminAnalyticsPeriod(period) ? period : "30D";
  const organization = await db.organization.findUnique({
    select: {
      id: true,
      module_settings: {
        select: {
          enabled: true,
          module: true
        }
      },
      status: true,
      time_zone: true
    },
    where: {
      id: organizationId
    }
  });

  if (!organization || organization.status !== "ACTIVE") {
    throw new Error("Organization is not available.");
  }

  const resolvedTimeZone = normalizeTimeZone(timeZone ?? organization.time_zone);
  const periodDays = getAdminAnalyticsPeriodDays(parsedPeriod);
  const today = startOfZonedDay(now, resolvedTimeZone);
  const from = addDays(today, -(periodDays - 1));
  const previousTo = from;
  const previousFrom = addDays(previousTo, -periodDays);
  const staffSetting = organization.module_settings.find((setting) => setting.module === "STAFF");
  const staffEnabled = staffSetting?.enabled ?? DEFAULT_GUEST_MENU_ENABLED_BY_ID.staff;
  const rows = await db.submission.findMany({
    orderBy: {
      created_at: "asc"
    },
    select: {
      attachments: {
        select: {
          id: true
        },
        take: 1
      },
      body_text: true,
      created_at: true,
      customer_contact_phone: true,
      kind: true,
      metadata: true,
      qr_context: true,
      rating: true,
      target_staff_member: {
        select: {
          display_name: true,
          id: true,
          role_title: true
        }
      }
    } satisfies Prisma.SubmissionSelect,
    where: {
      created_at: {
        gte: previousFrom,
        lte: now
      },
      organization_id: organization.id
    }
  });
  const currentRows = rows.filter((row) => row.created_at >= from);
  const previousRows = rows.filter(
    (row) => row.created_at < from && row.created_at >= previousFrom
  );

  return buildAnalyticsPayload({
    currentRows,
    from,
    organizationId: organization.id,
    period: parsedPeriod,
    previousFrom,
    previousRows,
    previousTo,
    staffEnabled,
    timeZone: resolvedTimeZone,
    to: now
  });
};
