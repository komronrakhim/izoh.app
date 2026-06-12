import type { SubmissionKindInput } from "~/shared/submissions";

export const ADMIN_ANALYTICS_PERIODS = ["7D", "30D", "90D"] as const;

export type AdminAnalyticsPeriod = (typeof ADMIN_ANALYTICS_PERIODS)[number];

export type AdminAnalyticsCountSet = Record<"ALL" | SubmissionKindInput, number>;

export type AdminAnalyticsRatingDistribution = Record<"1" | "2" | "3" | "4" | "5", number>;

export type AdminAnalyticsTrend = {
  current: number;
  direction: "down" | "flat" | "up";
  previous: number;
};

export type AdminAnalyticsBreakdownItem = {
  count: number;
  id: string;
};

export type AdminAnalyticsContextItem = {
  complaintCount: number;
  count: number;
  label: string;
  lowReviewCount: number;
};

export type AdminAnalyticsStaffItem = {
  complaintCount: number;
  displayName: string;
  id: string;
  lowReviewCount: number;
  mentionsCount: number;
  roleTitle: string;
  thanksCount: number;
};

export type AdminAnalyticsDayItem = AdminAnalyticsCountSet & {
  date: string;
};

export type AdminAnalyticsWeekdayItem = {
  count: number;
  day: number;
};

export type AdminAnalyticsPeakHour = {
  count: number;
  hour: number;
};

export type AdminAnalyticsPayload = {
  contexts: AdminAnalyticsContextItem[];
  engagement: {
    withContact: number;
    withPhotos: number;
    withText: number;
  };
  organizationId: string;
  period: AdminAnalyticsPeriod;
  range: {
    from: string;
    previousFrom: string;
    previousTo: string;
    timeZone: string;
    to: string;
  };
  rating: {
    average: null | number;
    distribution: AdminAnalyticsRatingDistribution;
    negativeCount: number;
    neutralCount: number;
    positiveCount: number;
    previousAverage: null | number;
  };
  staff: {
    enabled: boolean;
    items: AdminAnalyticsStaffItem[];
    team: {
      complaintCount: number;
      mentionsCount: number;
      thanksCount: number;
    };
    unknownMentionsCount: number;
  };
  time: {
    daily: AdminAnalyticsDayItem[];
    peakHour: AdminAnalyticsPeakHour | null;
    weekdays: AdminAnalyticsWeekdayItem[];
  };
  topics: {
    complaint: AdminAnalyticsBreakdownItem[];
    suggestion: AdminAnalyticsBreakdownItem[];
  };
  totals: {
    counts: AdminAnalyticsCountSet;
    trend: AdminAnalyticsTrend;
  };
};

export const isAdminAnalyticsPeriod = (value: string): value is AdminAnalyticsPeriod =>
  ADMIN_ANALYTICS_PERIODS.includes(value as AdminAnalyticsPeriod);

export const getAdminAnalyticsPeriodDays = (period: AdminAnalyticsPeriod) => {
  if (period === "7D") return 7;
  if (period === "90D") return 90;

  return 30;
};
