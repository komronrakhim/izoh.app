import { randomBytes } from "node:crypto";
import type {
  OrganizationSubscription,
  OrganizationSubscriptionPayment,
  Prisma,
  SubscriptionPlanCode
} from "../../../prisma/generated/prisma/client";

import { getTelegramBot } from "~/server/telegram";
import { type DomainDb, getDomainDb } from "~/server/domain/shared";
import {
  ANNUAL_SUBSCRIPTION_PERIOD_DAYS,
  MONTHLY_SUBSCRIPTION_PERIOD_SECONDS,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_TRIAL_DAYS,
  getSubscriptionPlan,
  getSubscriptionPlanAmountStars,
  type OrganizationSubscriptionPayload,
  type SubscriptionInvoicePayload
} from "~/shared/subscriptions";
import { createTranslator, type AppLocale } from "~/shared/i18n";

const STARS_CURRENCY = "XTR";
const INVOICE_PAYLOAD_PREFIX = "izoh_sub";

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
  now = new Date()
): OrganizationSubscriptionPayload => {
  const status = resolveOrganizationSubscriptionStatus(subscription, now);
  const amountStars = subscription.plan_code
    ? getSubscriptionPlanAmountStars(subscription.plan_code)
    : undefined;

  return {
    amountStars,
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
) =>
  toOrganizationSubscriptionPayload(await getOrCreateOrganizationSubscription(organizationId, db));

const createInvoicePayload = () => `${INVOICE_PAYLOAD_PREFIX}_${randomBytes(10).toString("hex")}`;

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
  const plan = getSubscriptionPlan(planCode);
  const invoicePayload = createInvoicePayload();

  const payment = await db.organizationSubscriptionPayment.create({
    data: {
      amount_stars: plan.amountStars,
      currency: STARS_CURRENCY,
      is_recurring: plan.recurring,
      organization_id: organizationId,
      payer_user_id: payerUserId,
      plan_code: planCode,
      status: "PENDING",
      subscription_id: subscription.id,
      telegram_invoice_payload: invoicePayload
    }
  });

  await db.organizationSubscriptionEvent.create({
    data: {
      actor_user_id: payerUserId,
      metadata: {
        amountStars: plan.amountStars,
        planCode
      } as Prisma.InputJsonObject,
      organization_id: organizationId,
      payment_id: payment.id,
      subscription_id: subscription.id,
      type: "INVOICE_CREATED"
    }
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
    invoiceLink,
    paymentId: payment.id,
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
  const payment = await db.organizationSubscriptionPayment.findFirst({
    orderBy: {
      created_at: "desc"
    },
    select: {
      amount_stars: true,
      currency: true,
      status: true
    },
    where: {
      status: "PENDING",
      telegram_invoice_payload: invoicePayload
    }
  });
  const ok =
    Boolean(payment) &&
    payment?.status === "PENDING" &&
    payment.currency === currency &&
    payment.amount_stars === totalAmount;

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

  const payment = await db.organizationSubscriptionPayment.findFirst({
    include: {
      subscription: true
    },
    orderBy: {
      created_at: "desc"
    },
    where: {
      telegram_invoice_payload: invoicePayload
    }
  });

  if (!payment) {
    throw new Error("Subscription payment is not available.");
  }

  const paymentToApply =
    payment.status === "PAID"
      ? await db.organizationSubscriptionPayment.create({
          data: {
            amount_stars: payment.amount_stars,
            currency: payment.currency,
            is_recurring: Boolean(isRecurring),
            organization_id: payment.organization_id,
            payer_user_id: payment.payer_user_id,
            plan_code: payment.plan_code,
            status: "PENDING",
            subscription_id: payment.subscription_id,
            telegram_invoice_payload: invoicePayload
          },
          include: {
            subscription: true
          }
        })
      : payment;

  if (paymentToApply.amount_stars !== totalAmount) {
    await db.organizationSubscriptionPayment.update({
      data: {
        status: "FAILED"
      },
      where: {
        id: paymentToApply.id
      }
    });

    throw new Error("Subscription payment amount does not match.");
  }

  const now = new Date();
  const paidPayment = await db.organizationSubscriptionPayment.update({
    data: {
      is_first_recurring: Boolean(isFirstRecurring),
      is_recurring: Boolean(isRecurring),
      paid_at: now,
      provider_payment_charge_id: providerPaymentChargeId,
      raw_payload: rawPayload as Prisma.InputJsonValue,
      status: "PAID",
      subscription_expiration_date: subscriptionExpirationDate,
      telegram_payment_charge_id: telegramPaymentChargeId
    },
    where: {
      id: paymentToApply.id
    }
  });
  const periodEndsAt = getPaymentPeriodEnd({
    now,
    payment: {
      ...paidPayment,
      plan_code: paymentToApply.plan_code
    },
    subscription: paymentToApply.subscription
  });

  await db.organizationSubscription.update({
    data: {
      current_period_ends_at: periodEndsAt,
      current_period_started_at: now,
      plan_code: paymentToApply.plan_code,
      source: "TELEGRAM_STARS",
      status: "ACTIVE",
      telegram_payment_charge_id: telegramPaymentChargeId
    },
    where: {
      id: paymentToApply.subscription_id
    }
  });

  await db.organizationSubscriptionEvent.create({
    data: {
      metadata: {
        amountStars: paymentToApply.amount_stars,
        isRecurring: Boolean(isRecurring),
        planCode: paymentToApply.plan_code
      } as Prisma.InputJsonObject,
      organization_id: paymentToApply.organization_id,
      payment_id: paymentToApply.id,
      subscription_id: paymentToApply.subscription_id,
      type: paymentToApply.is_recurring ? "RENEWED" : "PAYMENT_PAID"
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
