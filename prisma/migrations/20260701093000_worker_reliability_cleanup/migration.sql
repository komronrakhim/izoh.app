ALTER TABLE "QrPdfDelivery"
  ADD COLUMN IF NOT EXISTS "start_param" TEXT,
  ADD COLUMN IF NOT EXISTS "template" JSONB,
  ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "QrPdfDelivery_status_next_attempt_at_locked_until_idx"
  ON "QrPdfDelivery"("status", "next_attempt_at", "locked_until");

DELETE FROM "TelegramNotificationDelivery"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "submission_id", "target_id"
        ORDER BY "created_at" ASC, "id" ASC
      ) AS "delivery_rank"
    FROM "TelegramNotificationDelivery"
  ) AS "ranked_deliveries"
  WHERE "delivery_rank" > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramNotificationDelivery_submission_id_target_id_key"
  ON "TelegramNotificationDelivery"("submission_id", "target_id");

DROP TABLE IF EXISTS "BroadcastRecipient";
DROP TABLE IF EXISTS "Broadcast";
DROP TYPE IF EXISTS "BroadcastRecipientStatus";
DROP TYPE IF EXISTS "BroadcastStatus";
DROP TYPE IF EXISTS "BroadcastTargetKind";
