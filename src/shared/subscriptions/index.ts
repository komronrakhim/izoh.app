export const SUBSCRIPTION_TRIAL_DAYS = 7;
export const MONTHLY_SUBSCRIPTION_PERIOD_SECONDS = 30 * 24 * 60 * 60;
export const ANNUAL_SUBSCRIPTION_PERIOD_DAYS = 365;

export type SubscriptionPlanCode = "MONTHLY" | "ANNUAL";
export type OrganizationSubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "EXPIRED"
  | "CANCELED"
  | "GRANTED";
export type OrganizationSubscriptionSource = "TRIAL" | "TELEGRAM_STARS" | "ADMIN_GRANT";
export type OrganizationSubscriptionPaymentStatus =
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELED";

export type SubscriptionPlan = {
  code: SubscriptionPlanCode;
  amountStars: number;
  period: "month" | "year";
  recurring: boolean;
};

export const SUBSCRIPTION_PLANS = {
  MONTHLY: {
    amountStars: 500,
    code: "MONTHLY",
    period: "month",
    recurring: true
  },
  ANNUAL: {
    amountStars: 5000,
    code: "ANNUAL",
    period: "year",
    recurring: false
  }
} as const satisfies Record<SubscriptionPlanCode, SubscriptionPlan>;

export type OrganizationSubscriptionPayload = {
  amountStars?: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodEndsAt?: string | null;
  currentPeriodStartedAt?: string | null;
  isActive: boolean;
  planCode?: SubscriptionPlanCode | null;
  source: OrganizationSubscriptionSource;
  status: OrganizationSubscriptionStatus;
  trialEndsAt?: string | null;
  trialStartedAt?: string | null;
};

export type SubscriptionInvoicePayload = {
  invoiceId: string;
  invoiceLink: string;
  plan: SubscriptionPlan;
  subscription: OrganizationSubscriptionPayload;
};

export const getSubscriptionPlan = (planCode: SubscriptionPlanCode) => SUBSCRIPTION_PLANS[planCode];

export const isSubscriptionPlanCode = (value: unknown): value is SubscriptionPlanCode =>
  value === "MONTHLY" || value === "ANNUAL";

export const getSubscriptionPlanAmountStars = (planCode: SubscriptionPlanCode) =>
  getSubscriptionPlan(planCode).amountStars;

export const getAnnualSubscriptionDiscountPercent = () => {
  const monthlyYearAmount = SUBSCRIPTION_PLANS.MONTHLY.amountStars * 12;
  const annualAmount = SUBSCRIPTION_PLANS.ANNUAL.amountStars;

  return Math.max(0, Math.round(((monthlyYearAmount - annualAmount) / monthlyYearAmount) * 100));
};
