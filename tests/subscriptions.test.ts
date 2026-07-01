import { describe, expect, it, vi } from "vitest";

import { createApiApp } from "~/server/api/app";
import {
  getSubscriptionPricingPayload,
  updateSubscriptionPricing
} from "~/server/domain/subscription-pricing";
import {
  createInitialOrganizationSubscriptionData,
  isOrganizationSubscriptionActive,
  resolveOrganizationSubscriptionStatus
} from "~/server/domain/subscriptions";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_TRIAL_DAYS,
  createSubscriptionPlans,
  getAnnualSubscriptionDiscountPercent
} from "~/shared/subscriptions";

const restoreDatabaseUrl = (databaseUrl: string | undefined) => {
  if (databaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = databaseUrl;
};

describe("subscriptions", () => {
  it("keeps pricing in shared constants", () => {
    const expectedAnnualDiscount = Math.max(
      0,
      Math.round(
        ((SUBSCRIPTION_PLANS.MONTHLY.amountStars * 12 - SUBSCRIPTION_PLANS.ANNUAL.amountStars) /
          (SUBSCRIPTION_PLANS.MONTHLY.amountStars * 12)) *
          100
      )
    );

    expect(SUBSCRIPTION_PLANS.MONTHLY.amountStars).toBeGreaterThan(0);
    expect(SUBSCRIPTION_PLANS.MONTHLY.recurring).toBe(true);
    expect(SUBSCRIPTION_PLANS.ANNUAL.amountStars).toBe(5000);
    expect(SUBSCRIPTION_PLANS.ANNUAL.recurring).toBe(false);
    expect(getAnnualSubscriptionDiscountPercent()).toBe(expectedAnnualDiscount);
    expect(
      getAnnualSubscriptionDiscountPercent(
        createSubscriptionPlans({
          ANNUAL: 6000,
          MONTHLY: 500
        })
      )
    ).toBe(0);
  });

  it("uses default subscription pricing when no system setting exists", async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => null)
      }
    } as never;

    await expect(getSubscriptionPricingPayload(db)).resolves.toMatchObject({
      annualDiscountPercent: 17,
      plans: {
        ANNUAL: {
          amountStars: 5000
        },
        MONTHLY: {
          amountStars: 500
        }
      }
    });
  });

  it("updates subscription pricing dynamically", async () => {
    let value: unknown = null;
    const systemSetting = {
      findUnique: vi.fn(async () => (value ? { value } : null)),
      upsert: vi.fn(async ({ create, update }) => {
        value = update.value ?? create.value;
        return {
          key: "subscription.pricing",
          value
        };
      })
    };
    const db = {
      systemSetting: {
        findUnique: systemSetting.findUnique,
        upsert: systemSetting.upsert
      }
    } as never;

    await expect(
      updateSubscriptionPricing(
        {
          annualAmountStars: 6200,
          monthlyAmountStars: 500,
          updatedByUserId: "user_1"
        },
        db
      )
    ).resolves.toMatchObject({
      annualDiscountPercent: 0,
      plans: {
        ANNUAL: {
          amountStars: 6200
        },
        MONTHLY: {
          amountStars: 500
        }
      }
    });

    expect(systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          updated_by_user_id: "user_1"
        }),
        update: expect.objectContaining({
          updated_by_user_id: "user_1"
        })
      })
    );
  });

  it("starts every organization with a seven day trial", () => {
    const now = new Date("2026-06-11T10:00:00.000Z");
    const trial = createInitialOrganizationSubscriptionData(now);

    expect(trial.status).toBe("TRIALING");
    expect(trial.trial_started_at).toEqual(now);
    expect(trial.trial_ends_at).toEqual(new Date("2026-06-18T10:00:00.000Z"));
    expect(SUBSCRIPTION_TRIAL_DAYS).toBe(7);
  });

  it("treats expired access as inactive without needing a database write first", () => {
    const now = new Date("2026-06-11T10:00:00.000Z");
    const subscription = {
      cancel_at_period_end: false,
      current_period_ends_at: new Date("2026-06-10T10:00:00.000Z"),
      current_period_started_at: new Date("2026-06-03T10:00:00.000Z"),
      plan_code: "MONTHLY" as const,
      source: "TELEGRAM_STARS" as const,
      status: "ACTIVE" as const,
      trial_ends_at: new Date("2026-06-03T10:00:00.000Z"),
      trial_started_at: new Date("2026-05-27T10:00:00.000Z")
    };

    expect(resolveOrganizationSubscriptionStatus(subscription, now)).toBe("EXPIRED");
    expect(isOrganizationSubscriptionActive(subscription, now)).toBe(false);
  });

  it("requires a database for subscription settings", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const response = await createApiApp().request("/api/organizations/org_1/subscription");
    const payload = (await response.json()) as { error: string };

    restoreDatabaseUrl(databaseUrl);

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });
});
