DELETE FROM "OrganizationSubscriptionEvent"
WHERE "type" = 'INVOICE_CREATED';

DELETE FROM "OrganizationSubscriptionPayment"
WHERE "status" = 'PENDING';

ALTER TABLE "OrganizationSubscriptionPayment"
ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "OrganizationSubscriptionPaymentStatus_new" AS ENUM (
  'PAID',
  'FAILED',
  'REFUNDED',
  'CANCELED'
);

ALTER TABLE "OrganizationSubscriptionPayment"
ALTER COLUMN "status" TYPE "OrganizationSubscriptionPaymentStatus_new"
USING ("status"::text::"OrganizationSubscriptionPaymentStatus_new");

DROP TYPE "OrganizationSubscriptionPaymentStatus";

ALTER TYPE "OrganizationSubscriptionPaymentStatus_new"
RENAME TO "OrganizationSubscriptionPaymentStatus";

CREATE TYPE "OrganizationSubscriptionEventType_new" AS ENUM (
  'TRIAL_STARTED',
  'PAYMENT_PAID',
  'PAYMENT_FAILED',
  'REFUNDED',
  'ADMIN_GRANTED',
  'EXPIRED',
  'CANCELED',
  'RENEWED'
);

ALTER TABLE "OrganizationSubscriptionEvent"
ALTER COLUMN "type" TYPE "OrganizationSubscriptionEventType_new"
USING ("type"::text::"OrganizationSubscriptionEventType_new");

DROP TYPE "OrganizationSubscriptionEventType";

ALTER TYPE "OrganizationSubscriptionEventType_new"
RENAME TO "OrganizationSubscriptionEventType";
