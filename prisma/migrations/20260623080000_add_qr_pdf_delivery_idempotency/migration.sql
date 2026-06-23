CREATE TYPE "QrPdfDeliveryStatus" AS ENUM ('PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "QrPdfDelivery" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_request_id" TEXT NOT NULL,
    "status" "QrPdfDeliveryStatus" NOT NULL DEFAULT 'PROCESSING',
    "file_name" TEXT NOT NULL,
    "telegram_message_id" INTEGER,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrPdfDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QrPdfDelivery_client_request_id_key"
ON "QrPdfDelivery"("client_request_id");

CREATE INDEX "QrPdfDelivery_organization_id_user_id_created_at_idx"
ON "QrPdfDelivery"("organization_id", "user_id", "created_at");

CREATE INDEX "QrPdfDelivery_status_created_at_idx"
ON "QrPdfDelivery"("status", "created_at");

ALTER TABLE "QrPdfDelivery"
ADD CONSTRAINT "QrPdfDelivery_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QrPdfDelivery"
ADD CONSTRAINT "QrPdfDelivery_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
