import { z } from "zod";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import {
  DEFAULT_SUBSCRIPTION_PLAN_AMOUNTS,
  createSubscriptionPlans,
  getAnnualSubscriptionDiscountPercent,
  type SubscriptionPlanAmounts,
  type SubscriptionPlans
} from "~/shared/subscriptions";
import type { SystemSubscriptionPricingPayload } from "~/shared/system";

const SUBSCRIPTION_PRICING_SETTING_KEY = "subscription.pricing";
const maxSubscriptionPriceStars = 1_000_000;

const subscriptionPricingSchema = z.object({
  annualAmountStars: z.number().int().min(1).max(maxSubscriptionPriceStars),
  monthlyAmountStars: z.number().int().min(1).max(maxSubscriptionPriceStars)
});

const toPlanAmounts = (
  pricing: z.infer<typeof subscriptionPricingSchema>
): SubscriptionPlanAmounts => ({
  ANNUAL: pricing.annualAmountStars,
  MONTHLY: pricing.monthlyAmountStars
});

const parseSubscriptionPricing = (value: unknown): SubscriptionPlanAmounts => {
  const parsed = subscriptionPricingSchema.safeParse(value);

  if (!parsed.success) {
    return DEFAULT_SUBSCRIPTION_PLAN_AMOUNTS;
  }

  return toPlanAmounts(parsed.data);
};

export const getSubscriptionPlanAmounts = async (
  db: DomainDb = getDomainDb()
): Promise<SubscriptionPlanAmounts> => {
  const setting = await db.systemSetting.findUnique({
    where: {
      key: SUBSCRIPTION_PRICING_SETTING_KEY
    }
  });

  return parseSubscriptionPricing(setting?.value);
};

export const getSubscriptionPlans = async (
  db: DomainDb = getDomainDb()
): Promise<SubscriptionPlans> => createSubscriptionPlans(await getSubscriptionPlanAmounts(db));

export const getSubscriptionPricingPayload = async (
  db: DomainDb = getDomainDb()
): Promise<SystemSubscriptionPricingPayload> => {
  const plans = await getSubscriptionPlans(db);

  return {
    annualDiscountPercent: getAnnualSubscriptionDiscountPercent(plans),
    plans
  };
};

export const updateSubscriptionPricing = async (
  {
    annualAmountStars,
    monthlyAmountStars,
    updatedByUserId
  }: {
    annualAmountStars: number;
    monthlyAmountStars: number;
    updatedByUserId?: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const pricing = subscriptionPricingSchema.parse({
    annualAmountStars,
    monthlyAmountStars
  });

  await db.systemSetting.upsert({
    create: {
      key: SUBSCRIPTION_PRICING_SETTING_KEY,
      updated_by_user_id: updatedByUserId,
      value: pricing
    },
    update: {
      updated_by_user_id: updatedByUserId,
      value: pricing
    },
    where: {
      key: SUBSCRIPTION_PRICING_SETTING_KEY
    }
  });

  return getSubscriptionPricingPayload(db);
};
