import { getPrisma } from "~/server/db";
import { grantOrganizationSubscription } from "~/server/domain/subscriptions";
import { isSubscriptionPlanCode, type SubscriptionPlanCode } from "~/shared/subscriptions";

const args = process.argv.slice(2);

const getArg = (name: string) => {
  const index = args.findIndex((arg) => arg === `--${name}`);

  return index >= 0 ? args[index + 1] : undefined;
};

const organizationRef = getArg("org");
const planArg = getArg("plan")?.toUpperCase();
const reason = getArg("reason");

if (!organizationRef) {
  console.error(
    'Usage: npm run admin:grant-subscription -- --org <organization_id_or_slug> [--plan annual|monthly] [--reason "..."]'
  );
  process.exit(1);
}

const planCode: SubscriptionPlanCode = isSubscriptionPlanCode(planArg) ? planArg : "ANNUAL";
const db = getPrisma();

if (!db) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

try {
  const organization = await db.organization.findFirst({
    select: {
      id: true,
      name: true,
      slug: true
    },
    where: {
      OR: [
        {
          id: organizationRef
        },
        {
          slug: organizationRef
        }
      ],
      status: "ACTIVE"
    }
  });

  if (!organization) {
    throw new Error("Organization was not found.");
  }

  const subscription = await grantOrganizationSubscription(
    {
      organizationId: organization.id,
      planCode,
      reason
    },
    db
  );

  console.log(
    [
      "Subscription granted.",
      `Organization: ${organization.name} (${organization.slug})`,
      `Plan: ${subscription.plan_code}`,
      `Status: ${subscription.status}`,
      `Valid until: ${subscription.current_period_ends_at?.toISOString() ?? "not set"}`
    ].join("\n")
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? `Failed to grant subscription: ${error.message}`
      : "Failed to grant subscription."
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
