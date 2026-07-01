import type {
  OrganizationSubscription,
  OrganizationSubscriptionPayment,
  Prisma,
  SubscriptionPlanCode
} from "../../../prisma/generated/prisma/client";

import { getTelegramBot } from "~/server/telegram";
import { getSubscriptionPlans } from "~/server/domain/subscription-pricing";
import { type DomainDb, getDomainDb } from "~/server/domain/shared";
import {
  ANNUAL_SUBSCRIPTION_PERIOD_DAYS,
  MONTHLY_SUBSCRIPTION_PERIOD_SECONDS,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_TRIAL_DAYS,
  type OrganizationSubscriptionPayload,
  type SubscriptionInvoicePayload
} from "~/shared/subscriptions";
import { type AppLocale } from "~/shared/i18n";
import { createTranslator } from "~/shared/i18n/server";

const STARS_CURRENCY = "XTR";
const INVOICE_PAYLOAD_PREFIX = "izoh_sub";
const LEGACY_INVOICE_PAYLOAD_VERSION = "1";
const INVOICE_PAYLOAD_VERSION = "2";

type SubscriptionLike = Pick<
  OrganizationSubscription,
  | "cancel_at_period_end"
  | "current_period_ends_at"
  | "current_period_started_at"
  | "plan_code"
  | "source"
  | "status"
  | "trial_ends_at"
  | "trial_started_at"
>;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);

  next.setDate(next.getDate() + days);

  return next;
};

const addSeconds = (date: Date, seconds: number) => {
  const next = new Date(date);

  next.setSeconds(next.getSeconds() + seconds);

  return next;
};

const toIso = (date: Date | null | undefined) => date?.toISOString() ?? null;

export const createInitialOrganizationSubscriptionData = (
  now = new Date()
): Prisma.OrganizationSubscriptionCreateWithoutOrganizationInput => {
  const trialEndsAt = addDays(now, SUBSCRIPTION_TRIAL_DAYS);

  return {
    current_period_ends_at: trialEndsAt,
    current_period_started_at: now,
    source: "TRIAL",
    status: "TRIALING",
    trial_ends_at: trialEndsAt,
    trial_started_at: now
  };
};

export const resolveOrganizationSubscriptionStatus = (
  subscription: SubscriptionLike,
  now = new Date()
): OrganizationSubscriptionPayload["status"] => {
  if (subscription.status === "CANCELED") {
    return "CANCELED";
  }

  const endsAt = subscription.current_period_ends_at ?? subscription.trial_ends_at;

  if (endsAt && endsAt.getTime() <= now.getTime()) {
    return "EXPIRED";
  }

  return subscription.status;
};

export const isOrganizationSubscriptionActive = (
  subscription: SubscriptionLike | null | undefined,
  now = new Date()
) => {
  if (!subscription) {
    return false;
  }

  const status = resolveOrganizationSubscriptionStatus(subscription, now);

  return status === "TRIALING" || status === "ACTIVE" || status === "GRANTED";
};

export const toOrganizationSubscriptionPayload = (
  subscription: SubscriptionLike,
  now = new Date(),
  options: {
    amountStars?: number;
  } = {}
): OrganizationSubscriptionPayload => {
  const status = resolveOrganizationSubscriptionStatus(subscription, now);

  return {
    amountStars: options.amountStars,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEndsAt: toIso(subscription.current_period_ends_at),
    currentPeriodStartedAt: toIso(subscription.current_period_started_at),
    isActive: isOrganizationSubscriptionActive(subscription, now),
    planCode: subscription.plan_code,
    source: subscription.source,
    status,
    trialEndsAt: toIso(subscription.trial_ends_at),
    trialStartedAt: toIso(subscription.trial_started_at)
  };
};

export const getOrCreateOrganizationSubscription = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
) => {
  const organization = await db.organization.findFirst({
    include: {
      subscription: true
    },
    where: {
      id: organizationId,
      status: "ACTIVE"
    }
  });

  if (!organization) {
    throw new Error("Organization is not available.");
  }

  if (organization.subscription) {
    return organization.subscription;
  }

  const subscription = await db.organizationSubscription.create({
    data: {
      ...createInitialOrganizationSubscriptionData(),
      organization: {
        connect: {
          id: organization.id
        }
      }
    }
  });

  await db.organizationSubscriptionEvent.create({
    data: {
      organization_id: organization.id,
      subscription_id: subscription.id,
      type: "TRIAL_STARTED"
    }
  });

  return subscription;
};

export const getOrganizationSubscriptionPayload = async (
  organizationId: string,
  db: DomainDb = getDomainDb()
) => {
  const subscription = await getOrCreateOrganizationSubscription(organizationId, db);
  const latestPaidPayment =
    subscription.source === "TELEGRAM_STARS"
      ? await db.organizationSubscriptionPayment.findFirst({
          orderBy: {
            paid_at: "desc"
          },
          select: {
            amount_stars: true
          },
          where: {
            subscription_id: subscription.id,
            status: "PAID"
          }
        })
      : null;

  return toOrganizationSubscriptionPayload(subscription, new Date(), {
    amountStars: latestPaidPayment?.amount_stars
  });
};

const invoicePayloadPlanCode = {
  ANNUAL: "a",
  MONTHLY: "m"
} as const satisfies Record<SubscriptionPlanCode, string>;

const invoicePayloadPlanCodeByValue: Record<string, SubscriptionPlanCode> = {
  a: "ANNUAL",
  m: "MONTHLY"
};

const createInvoicePayload = ({
  amountStars,
  organizationId,
  payerUserId,
  planCode
}: {
  amountStars: number;
  organizationId: string;
  payerUserId?: string;
  planCode: SubscriptionPlanCode;
}) =>
  [
    INVOICE_PAYLOAD_PREFIX,
    INVOICE_PAYLOAD_VERSION,
    invoicePayloadPlanCode[planCode],
    String(amountStars),
    organizationId,
    payerUserId || "-"
  ].join(":");

const parseInvoicePayload = (invoicePayload: string) => {
  const [prefix, version, planCodeValue, fourthValue, fifthValue, sixthValue, ...rest] =
    invoicePayload.split(":");

  if (rest.length > 0 || prefix !== INVOICE_PAYLOAD_PREFIX) {
    return null;
  }

  const planCode = invoicePayloadPlanCodeByValue[planCodeValue ?? ""];

  if (!planCode || !version) {
    return null;
  }

  if (version === LEGACY_INVOICE_PAYLOAD_VERSION) {
    const organizationId = fourthValue;
    const payerUserId = fifthValue;

    if (!organizationId || sixthValue !== undefined) {
      return null;
    }

    return {
      amountStars: undefined,
      organizationId,
      payerUserId: payerUserId && payerUserId !== "-" ? payerUserId : undefined,
      planCode
    };
  }

  if (version !== INVOICE_PAYLOAD_VERSION) {
    return null;
  }

  const amountStars = Number(fourthValue);
  const organizationId = fifthValue;
  const payerUserId = sixthValue;

  if (!Number.isInteger(amountStars) || amountStars <= 0 || !organizationId) {
    return null;
  }

  return {
    amountStars,
    organizationId,
    payerUserId: payerUserId && payerUserId !== "-" ? payerUserId : undefined,
    planCode
  };
};

const getPaymentPeriodEnd = ({
  now,
  payment,
  subscription
}: {
  now: Date;
  payment: Pick<OrganizationSubscriptionPayment, "plan_code" | "subscription_expiration_date">;
  subscription: Pick<OrganizationSubscription, "current_period_ends_at">;
}) => {
  if (payment.plan_code === "MONTHLY") {
    return (
      payment.subscription_expiration_date ?? addSeconds(now, MONTHLY_SUBSCRIPTION_PERIOD_SECONDS)
    );
  }

  const base =
    subscription.current_period_ends_at && subscription.current_period_ends_at > now
      ? subscription.current_period_ends_at
      : now;

  return addDays(base, ANNUAL_SUBSCRIPTION_PERIOD_DAYS);
};

const getInvoiceText = (planCode: SubscriptionPlanCode, locale: AppLocale) => {
  const t = createTranslator(locale);

  return {
    description: t(`telegram.subscriptionInvoice.description.${planCode}`),
    label: t("telegram.subscriptionInvoice.label"),
    title: t(`telegram.subscriptionInvoice.title.${planCode}`)
  };
};

export const createOrganizationSubscriptionInvoice = async (
  {
    locale,
    organizationId,
    payerUserId,
    planCode
  }: {
    locale: AppLocale;
    organizationId: string;
    payerUserId?: string;
    planCode: SubscriptionPlanCode;
  },
  db: DomainDb = getDomainDb()
): Promise<SubscriptionInvoicePayload> => {
  const subscription = await getOrCreateOrganizationSubscription(organizationId, db);
  const plans = await getSubscriptionPlans(db);
  const plan = plans[planCode];
  const invoicePayload = createInvoicePayload({
    amountStars: plan.amountStars,
    organizationId,
    payerUserId,
    planCode
  });

  const text = getInvoiceText(planCode, locale);
  const invoiceLink = await getTelegramBot().api.createInvoiceLink(
    text.title,
    text.description,
    invoicePayload,
    "",
    STARS_CURRENCY,
    [
      {
        amount: plan.amountStars,
        label: text.label
      }
    ],
    planCode === "MONTHLY"
      ? {
          subscription_period: MONTHLY_SUBSCRIPTION_PERIOD_SECONDS
        }
      : undefined
  );

  return {
    invoiceId: invoicePayload,
    invoiceLink,
    plan,
    subscription: toOrganizationSubscriptionPayload(subscription)
  };
};

export const answerSubscriptionPreCheckoutQuery = async (
  {
    currency,
    id,
    invoicePayload,
    totalAmount
  }: {
    currency: string;
    id: string;
    invoicePayload: string;
    totalAmount: number;
  },
  db: DomainDb = getDomainDb()
) => {
  const payload = parseInvoicePayload(invoicePayload);
  const plans = payload ? await getSubscriptionPlans(db) : null;
  const plan = plans && payload ? plans[payload.planCode] : null;
  const expectedAmountStars = payload?.amountStars ?? plan?.amountStars;
  const organization = payload
    ? await db.organization.findFirst({
        select: {
          id: true
        },
        where: {
          id: payload.organizationId,
          status: "ACTIVE"
        }
      })
    : null;
  const ok =
    Boolean(payload) &&
    Boolean(plan) &&
    Boolean(organization) &&
    currency === STARS_CURRENCY &&
    expectedAmountStars === totalAmount;

  await getTelegramBot().api.answerPreCheckoutQuery(
    id,
    ok,
    ok
      ? undefined
      : {
          error_message: "Invoice is no longer available."
        }
  );
};

export const applySuccessfulSubscriptionPayment = async (
  {
    invoicePayload,
    isFirstRecurring,
    isRecurring,
    providerPaymentChargeId,
    rawPayload,
    subscriptionExpirationDate,
    telegramPaymentChargeId,
    totalAmount
  }: {
    invoicePayload: string;
    isFirstRecurring?: boolean;
    isRecurring?: boolean;
    providerPaymentChargeId?: string;
    rawPayload?: unknown;
    subscriptionExpirationDate?: Date;
    telegramPaymentChargeId: string;
    totalAmount: number;
  },
  db: DomainDb = getDomainDb()
) => {
  const existingPayment = await db.organizationSubscriptionPayment.findUnique({
    where: {
      telegram_payment_charge_id: telegramPaymentChargeId
    }
  });

  if (existingPayment) {
    return existingPayment;
  }

  const payload = parseInvoicePayload(invoicePayload);

  if (!payload) {
    throw new Error("Subscription payment is not available.");
  }

  const plans = await getSubscriptionPlans(db);
  const currentPlan = plans[payload.planCode];
  const amountStars = payload.amountStars ?? currentPlan.amountStars;
  const plan = {
    ...currentPlan,
    amountStars
  };

  if (plan.amountStars !== totalAmount) {
    throw new Error("Subscription payment amount does not match.");
  }

  const subscription = await getOrCreateOrganizationSubscription(payload.organizationId, db);
  const now = new Date();
  const paidPayment = await db.organizationSubscriptionPayment.create({
    data: {
      amount_stars: plan.amountStars,
      currency: STARS_CURRENCY,
      is_first_recurring: Boolean(isFirstRecurring),
      is_recurring: Boolean(isRecurring),
      organization_id: payload.organizationId,
      payer_user_id: payload.payerUserId,
      paid_at: now,
      plan_code: payload.planCode,
      provider_payment_charge_id: providerPaymentChargeId,
      raw_payload: rawPayload as Prisma.InputJsonValue,
      status: "PAID",
      subscription_id: subscription.id,
      subscription_expiration_date: subscriptionExpirationDate,
      telegram_invoice_payload: invoicePayload,
      telegram_payment_charge_id: telegramPaymentChargeId
    }
  });
  const periodEndsAt = getPaymentPeriodEnd({
    now,
    payment: {
      ...paidPayment,
      plan_code: payload.planCode
    },
    subscription
  });

  await db.organizationSubscription.update({
    data: {
      current_period_ends_at: periodEndsAt,
      current_period_started_at: now,
      plan_code: payload.planCode,
      source: "TELEGRAM_STARS",
      status: "ACTIVE",
      telegram_payment_charge_id: telegramPaymentChargeId
    },
    where: {
      id: subscription.id
    }
  });

  await db.organizationSubscriptionEvent.create({
    data: {
      metadata: {
        amountStars: paidPayment.amount_stars,
        isRecurring: Boolean(isRecurring),
        planCode: payload.planCode
      } as Prisma.InputJsonObject,
      organization_id: payload.organizationId,
      payment_id: paidPayment.id,
      subscription_id: subscription.id,
      type: Boolean(isRecurring) && !isFirstRecurring ? "RENEWED" : "PAYMENT_PAID"
    }
  });

  return paidPayment;
};

export const grantOrganizationSubscription = async (
  {
    grantedByUserId,
    organizationId,
    planCode = "ANNUAL",
    reason
  }: {
    grantedByUserId?: string;
    organizationId: string;
    planCode?: SubscriptionPlanCode;
    reason?: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const subscription = await getOrCreateOrganizationSubscription(organizationId, db);
  const now = new Date();
  const periodEndsAt =
    planCode === "MONTHLY"
      ? addSeconds(now, MONTHLY_SUBSCRIPTION_PERIOD_SECONDS)
      : addDays(now, ANNUAL_SUBSCRIPTION_PERIOD_DAYS);
  const updatedSubscription = await db.organizationSubscription.update({
    data: {
      current_period_ends_at: periodEndsAt,
      current_period_started_at: now,
      grant_reason: reason?.trim() || null,
      granted_by_user_id: grantedByUserId,
      plan_code: planCode,
      source: "ADMIN_GRANT",
      status: "GRANTED"
    },
    where: {
      id: subscription.id
    }
  });

  await db.organizationSubscriptionEvent.create({
    data: {
      actor_user_id: grantedByUserId,
      metadata: {
        planCode,
        reason: reason?.trim() || null
      } as Prisma.InputJsonObject,
      organization_id: organizationId,
      subscription_id: subscription.id,
      type: "ADMIN_GRANTED"
    }
  });

  return updatedSubscription;
};

export const cancelOrganizationSubscription = async (
  {
    actorUserId,
    organizationId,
    reason
  }: {
    actorUserId?: string;
    organizationId: string;
    reason?: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const subscription = await getOrCreateOrganizationSubscription(organizationId, db);
  const now = new Date();
  const updatedSubscription = await db.organizationSubscription.update({
    data: {
      cancel_at_period_end: false,
      current_period_ends_at: now,
      grant_reason: reason?.trim() || null,
      status: "CANCELED"
    },
    where: {
      id: subscription.id
    }
  });

  await db.organizationSubscriptionEvent.create({
    data: {
      actor_user_id: actorUserId,
      metadata: {
        reason: reason?.trim() || null
      } as Prisma.InputJsonObject,
      organization_id: organizationId,
      subscription_id: subscription.id,
      type: "CANCELED"
    }
  });

  return updatedSubscription;
};

export { SUBSCRIPTION_PLANS };
