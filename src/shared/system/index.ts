import type {
  OrganizationSubscriptionPaymentStatus,
  OrganizationSubscriptionSource,
  OrganizationSubscriptionStatus,
  SubscriptionPlanCode
} from "~/shared/subscriptions";
import type { AdminSubmissionItem, SubmissionKindInput } from "~/shared/submissions";

export const SYSTEM_PULSE_PERIODS = ["TODAY", "7D", "30D", "ALL"] as const;

export type SystemPulsePeriod = (typeof SYSTEM_PULSE_PERIODS)[number];

export type SystemPulseMetric = {
  previous?: number;
  total: number;
  trend?: "down" | "flat" | "up";
  value: number;
};

export type SystemPulseSubmissionItem = {
  createdAt: string;
  customerUser: null | SystemSubmissionCustomerUser;
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

export type SystemSubmissionCustomerUser = {
  firstName: string;
  id: string;
  lastName: null | string;
  phoneNumber: null | string;
  photoUrl: null | string;
  telegramId: string;
  username: null | string;
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
    source: null | OrganizationSubscriptionSource;
    status: null | OrganizationSubscriptionStatus;
  };
};

export type SystemUserItem = {
  createdAt: string;
  firstName: string;
  id: string;
  languageCode: null | string;
  lastName: null | string;
  locale: string;
  organizationCount: number;
  phoneNumber: null | string;
  photoUrl: null | string;
  scanCount: number;
  submissionCount: number;
  telegramId: string;
  username: null | string;
};

export type SystemSubmissionItem = AdminSubmissionItem & {
  customerUser: null | SystemSubmissionCustomerUser;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

export type SystemStarsPaymentItem = {
  amountStars: number;
  createdAt: string;
  currency: string;
  id: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  paidAt: null | string;
  payer: null | {
    firstName: string;
    id: string;
    lastName: null | string;
    telegramId: string;
    username: null | string;
  };
  planCode: SubscriptionPlanCode;
  status: OrganizationSubscriptionPaymentStatus;
  telegramPaymentChargeId: null | string;
};

export type SystemPulsePayload = {
  organizations: SystemPulseOrganizationItem[];
  period: SystemPulsePeriod;
  range: {
    from: null | string;
    to: string;
  };
  recentSubmissions: SystemPulseSubmissionItem[];
  scanConversion: {
    convertedScans: SystemPulseMetric;
    rate: null | number;
  };
  totals: {
    activeSubscriptions: SystemPulseMetric;
    organizations: SystemPulseMetric;
    paidStars: SystemPulseMetric;
    scans: SystemPulseMetric;
    submissions: SystemPulseMetric;
    users: SystemPulseMetric;
  };
};

export type SystemOrganizationsPayload = {
  items: SystemPulseOrganizationItem[];
  nextCursor: null | string;
  period: SystemPulsePeriod;
  total: number;
};

export type SystemOrganizationDetailPayload = {
  auditLogs: SystemAuditLogItem[];
  organization: SystemPulseOrganizationItem & {
    contactText: string;
    description: string;
  };
  period: SystemPulsePeriod;
  submissionsNextCursor: null | string;
  submissions: SystemSubmissionItem[];
};

export type SystemUsersPayload = {
  items: SystemUserItem[];
  nextCursor: null | string;
  period: SystemPulsePeriod;
  total: number;
};

export type SystemUserDetailPayload = {
  auditLogs: SystemAuditLogItem[];
  organizations: SystemPulseOrganizationItem[];
  stars: SystemStarsPaymentItem[];
  submissions: SystemSubmissionItem[];
  submissionsNextCursor: null | string;
  user: SystemUserItem;
};

export type SystemSubmissionsPayload = {
  items: SystemSubmissionItem[];
  nextCursor: null | string;
  period: SystemPulsePeriod;
  total: number;
};

export type SystemStarsPayload = {
  items: SystemStarsPaymentItem[];
  nextCursor: null | string;
  period: SystemPulsePeriod;
  totals: {
    paidPayments: number;
    paidStars: number;
    refundedPayments: number;
  };
};

export type SystemAuditLogItem = {
  action: string;
  actor: null | {
    firstName: string;
    id: string;
    lastName: null | string;
    telegramId: string;
    username: null | string;
  };
  createdAt: string;
  id: string;
  targetId: null | string;
  targetType: string;
};

export const isSystemPulsePeriod = (value: string): value is SystemPulsePeriod =>
  SYSTEM_PULSE_PERIODS.includes(value as SystemPulsePeriod);
