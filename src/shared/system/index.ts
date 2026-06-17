import type { SubscriptionPlanCode } from "~/shared/subscriptions";
import type { SubmissionKindInput } from "~/shared/submissions";

export const SYSTEM_PULSE_PERIODS = ["TODAY", "7D", "30D", "ALL"] as const;

export type SystemPulsePeriod = (typeof SYSTEM_PULSE_PERIODS)[number];

export type SystemPulseMetric = {
  total: number;
  value: number;
};

export type SystemPulseSubmissionItem = {
  createdAt: string;
  id: string;
  kind: SubmissionKindInput;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  preview: string;
  qrContext: null | string;
  rating: null | number;
};

export type SystemPulseOrganizationItem = {
  createdAt: string;
  id: string;
  logoUrl?: string;
  name: string;
  owner: {
    firstName: string;
    id: string;
    lastName: null | string;
    telegramId: string;
    username: null | string;
  };
  scanCount: number;
  slug: string;
  submissionCount: number;
  subscription: {
    currentPeriodEndsAt: null | string;
    isActive: boolean;
    planCode: null | SubscriptionPlanCode;
    source: string | null;
    status: string | null;
  };
};

export type SystemPulsePayload = {
  organizations: SystemPulseOrganizationItem[];
  period: SystemPulsePeriod;
  range: {
    from: null | string;
    to: string;
  };
  recentSubmissions: SystemPulseSubmissionItem[];
  totals: {
    activeSubscriptions: SystemPulseMetric;
    organizations: SystemPulseMetric;
    scans: SystemPulseMetric;
    submissions: SystemPulseMetric;
    users: SystemPulseMetric;
  };
};

export const isSystemPulsePeriod = (value: string): value is SystemPulsePeriod =>
  SYSTEM_PULSE_PERIODS.includes(value as SystemPulsePeriod);
