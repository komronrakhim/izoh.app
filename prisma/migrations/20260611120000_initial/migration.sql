-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LocaleSource" AS ENUM ('TELEGRAM', 'MANUAL');

-- CreateEnum
CREATE TYPE "UserSystemRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETING');

-- CreateEnum
CREATE TYPE "OrganizationDeletionJobStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "OrganizationModule" AS ENUM ('REVIEW', 'COMPLAINT', 'SUGGESTION', 'STAFF');

-- CreateEnum
CREATE TYPE "SubmissionKind" AS ENUM ('REVIEW', 'COMPLAINT', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "MediaOwnerType" AS ENUM ('USER', 'ORGANIZATION', 'STAFF_MEMBER', 'SUBMISSION');

-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('ORGANIZATION_LOGO', 'STAFF_AVATAR', 'SUBMISSION_PHOTO', 'SUBMISSION_THUMBNAIL');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "MediaUploadSessionStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrganizationNotificationMode" AS ENUM ('ALL', 'IMPORTANT_ONLY', 'OFF');

-- CreateEnum
CREATE TYPE "OrganizationNotificationTargetStatus" AS ENUM ('ACTIVE', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "TelegramDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TelegramNotificationTargetType" AS ENUM ('OWNER_DM', 'TELEGRAM_GROUP');

-- CreateEnum
CREATE TYPE "SubscriptionPlanCode" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "OrganizationSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'EXPIRED', 'CANCELED', 'GRANTED');

-- CreateEnum
CREATE TYPE "OrganizationSubscriptionSource" AS ENUM ('TRIAL', 'TELEGRAM_STARS', 'ADMIN_GRANT');

-- CreateEnum
CREATE TYPE "OrganizationSubscriptionPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "OrganizationSubscriptionEventType" AS ENUM ('TRIAL_STARTED', 'INVOICE_CREATED', 'PAYMENT_PAID', 'PAYMENT_FAILED', 'REFUNDED', 'ADMIN_GRANTED', 'EXPIRED', 'CANCELED', 'RENEWED');

-- CreateEnum
CREATE TYPE "BroadcastTargetKind" AS ENUM ('ALL_USERS', 'ORGANIZATION_OWNERS', 'SYSTEM_ADMINS');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "BroadcastRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "username" TEXT,
    "language_code" TEXT,
    "photo_url" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "locale_source" "LocaleSource" NOT NULL DEFAULT 'TELEGRAM',
    "system_role" "UserSystemRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "contact_text" TEXT NOT NULL DEFAULT '',
    "logo_media_asset_id" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "time_zone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationDeletionJob" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "requested_by_user_id" TEXT,
    "organization_name" TEXT NOT NULL,
    "organization_slug" TEXT NOT NULL,
    "storage_objects" JSONB,
    "status" "OrganizationDeletionJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationDeletionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationNotificationTarget" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "TelegramNotificationTargetType" NOT NULL,
    "status" "OrganizationNotificationTargetStatus" NOT NULL DEFAULT 'ACTIVE',
    "mode" "OrganizationNotificationMode" NOT NULL DEFAULT 'ALL',
    "review_enabled" BOOLEAN NOT NULL DEFAULT true,
    "complaint_enabled" BOOLEAN NOT NULL DEFAULT true,
    "suggestion_enabled" BOOLEAN NOT NULL DEFAULT true,
    "telegram_chat_id" BIGINT,
    "telegram_chat_title" TEXT,
    "recipient_user_id" TEXT,
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationNotificationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationNotificationGroupConnectToken" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationNotificationGroupConnectToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSubscription" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" "OrganizationSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "plan_code" "SubscriptionPlanCode",
    "source" "OrganizationSubscriptionSource" NOT NULL DEFAULT 'TRIAL',
    "trial_started_at" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "current_period_started_at" TIMESTAMP(3),
    "current_period_ends_at" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "telegram_payment_charge_id" TEXT,
    "granted_by_user_id" TEXT,
    "grant_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSubscriptionPayment" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "payer_user_id" TEXT,
    "plan_code" "SubscriptionPlanCode" NOT NULL,
    "amount_stars" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XTR',
    "status" "OrganizationSubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "telegram_invoice_payload" TEXT NOT NULL,
    "telegram_payment_charge_id" TEXT,
    "provider_payment_charge_id" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_first_recurring" BOOLEAN NOT NULL DEFAULT false,
    "subscription_expiration_date" TIMESTAMP(3),
    "raw_payload" JSONB,
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSubscriptionEvent" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "payment_id" TEXT,
    "actor_user_id" TEXT,
    "type" "OrganizationSubscriptionEventType" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationSubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationModuleSetting" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "module" "OrganizationModule" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationModuleSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationGuestContext" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationGuestContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role_title" TEXT NOT NULL DEFAULT '',
    "avatar_media_asset_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_user_id" TEXT,
    "target_staff_member_id" TEXT,
    "kind" "SubmissionKind" NOT NULL,
    "rating" INTEGER,
    "body_text" TEXT NOT NULL DEFAULT '',
    "customer_allows_reply" BOOLEAN NOT NULL DEFAULT false,
    "customer_contact_phone" TEXT,
    "customer_display_name" TEXT,
    "qr_context" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAttachment" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaUploadSession" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "owner_type" "MediaOwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "status" "MediaUploadSessionStatus" NOT NULL DEFAULT 'PENDING',
    "bucket" TEXT NOT NULL,
    "temp_storage_key" TEXT NOT NULL,
    "final_storage_key" TEXT,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_limit_bytes" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "uploaded_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaUploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "upload_session_id" TEXT,
    "owner_type" "MediaOwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'PROCESSING',
    "bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramNotificationDelivery" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_type" "TelegramNotificationTargetType" NOT NULL DEFAULT 'OWNER_DM',
    "recipient_user_id" TEXT,
    "status" "TelegramDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "telegram_chat_id" BIGINT,
    "telegram_message_ids" JSONB,
    "error" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "target_kind" "BroadcastTargetKind" NOT NULL DEFAULT 'ALL_USERS',
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "locale" TEXT,
    "text" TEXT NOT NULL,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastRecipient" (
    "id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "BroadcastRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "telegram_chat_id" BIGINT,
    "telegram_message_id" INTEGER,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegram_id_key" ON "User"("telegram_id");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_locale_idx" ON "User"("locale");

-- CreateIndex
CREATE INDEX "User_locale_source_idx" ON "User"("locale_source");

-- CreateIndex
CREATE INDEX "User_system_role_idx" ON "User"("system_role");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_owner_user_id_status_idx" ON "Organization"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "Organization_status_created_at_idx" ON "Organization"("status", "created_at");

-- CreateIndex
CREATE INDEX "Organization_time_zone_idx" ON "Organization"("time_zone");

-- CreateIndex
CREATE INDEX "OrganizationDeletionJob_organization_id_created_at_idx" ON "OrganizationDeletionJob"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationDeletionJob_requested_by_user_id_created_at_idx" ON "OrganizationDeletionJob"("requested_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationDeletionJob_status_next_attempt_at_locked_until_idx" ON "OrganizationDeletionJob"("status", "next_attempt_at", "locked_until");

-- CreateIndex
CREATE INDEX "OrganizationNotificationTarget_organization_id_status_idx" ON "OrganizationNotificationTarget"("organization_id", "status");

-- CreateIndex
CREATE INDEX "OrganizationNotificationTarget_organization_id_type_idx" ON "OrganizationNotificationTarget"("organization_id", "type");

-- CreateIndex
CREATE INDEX "OrganizationNotificationTarget_type_status_idx" ON "OrganizationNotificationTarget"("type", "status");

-- CreateIndex
CREATE INDEX "OrganizationNotificationTarget_telegram_chat_id_idx" ON "OrganizationNotificationTarget"("telegram_chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotificationGroupConnectToken_token_key" ON "OrganizationNotificationGroupConnectToken"("token");

-- CreateIndex
CREATE INDEX "OrganizationNotificationGroupConnectToken_organization_id_c_idx" ON "OrganizationNotificationGroupConnectToken"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationNotificationGroupConnectToken_created_by_user_i_idx" ON "OrganizationNotificationGroupConnectToken"("created_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationNotificationGroupConnectToken_token_expires_at_idx" ON "OrganizationNotificationGroupConnectToken"("token", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSubscription_organization_id_key" ON "OrganizationSubscription"("organization_id");

-- CreateIndex
CREATE INDEX "OrganizationSubscription_status_current_period_ends_at_idx" ON "OrganizationSubscription"("status", "current_period_ends_at");

-- CreateIndex
CREATE INDEX "OrganizationSubscription_source_status_idx" ON "OrganizationSubscription"("source", "status");

-- CreateIndex
CREATE INDEX "OrganizationSubscription_granted_by_user_id_created_at_idx" ON "OrganizationSubscription"("granted_by_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSubscriptionPayment_telegram_payment_charge_id_key" ON "OrganizationSubscriptionPayment"("telegram_payment_charge_id");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionPayment_organization_id_status_crea_idx" ON "OrganizationSubscriptionPayment"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionPayment_subscription_id_status_crea_idx" ON "OrganizationSubscriptionPayment"("subscription_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionPayment_payer_user_id_status_create_idx" ON "OrganizationSubscriptionPayment"("payer_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionPayment_telegram_invoice_payload_st_idx" ON "OrganizationSubscriptionPayment"("telegram_invoice_payload", "status", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionEvent_organization_id_created_at_idx" ON "OrganizationSubscriptionEvent"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionEvent_subscription_id_created_at_idx" ON "OrganizationSubscriptionEvent"("subscription_id", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionEvent_payment_id_created_at_idx" ON "OrganizationSubscriptionEvent"("payment_id", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionEvent_actor_user_id_created_at_idx" ON "OrganizationSubscriptionEvent"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionEvent_type_created_at_idx" ON "OrganizationSubscriptionEvent"("type", "created_at");

-- CreateIndex
CREATE INDEX "OrganizationModuleSetting_module_enabled_idx" ON "OrganizationModuleSetting"("module", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationModuleSetting_organization_id_module_key" ON "OrganizationModuleSetting"("organization_id", "module");

-- CreateIndex
CREATE INDEX "OrganizationGuestContext_organization_id_created_at_idx" ON "OrganizationGuestContext"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationGuestContext_organization_id_code_key" ON "OrganizationGuestContext"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationGuestContext_organization_id_label_key" ON "OrganizationGuestContext"("organization_id", "label");

-- CreateIndex
CREATE INDEX "StaffMember_organization_id_is_active_sort_order_idx" ON "StaffMember"("organization_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "Submission_organization_id_created_at_idx" ON "Submission"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "Submission_organization_id_kind_created_at_idx" ON "Submission"("organization_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "Submission_kind_created_at_idx" ON "Submission"("kind", "created_at");

-- CreateIndex
CREATE INDEX "Submission_target_staff_member_id_created_at_idx" ON "Submission"("target_staff_member_id", "created_at");

-- CreateIndex
CREATE INDEX "Submission_customer_user_id_created_at_idx" ON "Submission"("customer_user_id", "created_at");

-- CreateIndex
CREATE INDEX "SubmissionAttachment_submission_id_sort_order_idx" ON "SubmissionAttachment"("submission_id", "sort_order");

-- CreateIndex
CREATE INDEX "SubmissionAttachment_media_asset_id_idx" ON "SubmissionAttachment"("media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionAttachment_submission_id_media_asset_id_key" ON "SubmissionAttachment"("submission_id", "media_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUploadSession_temp_storage_key_key" ON "MediaUploadSession"("temp_storage_key");

-- CreateIndex
CREATE INDEX "MediaUploadSession_user_id_status_created_at_idx" ON "MediaUploadSession"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "MediaUploadSession_owner_type_owner_id_status_created_at_idx" ON "MediaUploadSession"("owner_type", "owner_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "MediaUploadSession_status_expires_at_idx" ON "MediaUploadSession"("status", "expires_at");

-- CreateIndex
CREATE INDEX "MediaUploadSession_kind_status_created_at_idx" ON "MediaUploadSession"("kind", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storage_key_key" ON "MediaAsset"("storage_key");

-- CreateIndex
CREATE INDEX "MediaAsset_upload_session_id_idx" ON "MediaAsset"("upload_session_id");

-- CreateIndex
CREATE INDEX "MediaAsset_owner_type_owner_id_kind_created_at_idx" ON "MediaAsset"("owner_type", "owner_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "MediaAsset_kind_status_created_at_idx" ON "MediaAsset"("kind", "status", "created_at");

-- CreateIndex
CREATE INDEX "TelegramNotificationDelivery_submission_id_status_idx" ON "TelegramNotificationDelivery"("submission_id", "status");

-- CreateIndex
CREATE INDEX "TelegramNotificationDelivery_target_id_status_created_at_idx" ON "TelegramNotificationDelivery"("target_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "TelegramNotificationDelivery_recipient_user_id_status_creat_idx" ON "TelegramNotificationDelivery"("recipient_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "TelegramNotificationDelivery_target_type_status_created_at_idx" ON "TelegramNotificationDelivery"("target_type", "status", "created_at");

-- CreateIndex
CREATE INDEX "TelegramNotificationDelivery_status_next_attempt_at_locked__idx" ON "TelegramNotificationDelivery"("status", "next_attempt_at", "locked_until");

-- CreateIndex
CREATE INDEX "Broadcast_created_by_user_id_created_at_idx" ON "Broadcast"("created_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "Broadcast_target_kind_status_idx" ON "Broadcast"("target_kind", "status");

-- CreateIndex
CREATE INDEX "Broadcast_status_created_at_idx" ON "Broadcast"("status", "created_at");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_user_id_status_created_at_idx" ON "BroadcastRecipient"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_status_created_at_idx" ON "BroadcastRecipient"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastRecipient_broadcast_id_user_id_key" ON "BroadcastRecipient"("broadcast_id", "user_id");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDeletionJob" ADD CONSTRAINT "OrganizationDeletionJob_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDeletionJob" ADD CONSTRAINT "OrganizationDeletionJob_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationTarget" ADD CONSTRAINT "OrganizationNotificationTarget_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationTarget" ADD CONSTRAINT "OrganizationNotificationTarget_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationGroupConnectToken" ADD CONSTRAINT "OrganizationNotificationGroupConnectToken_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationGroupConnectToken" ADD CONSTRAINT "OrganizationNotificationGroupConnectToken_created_by_user__fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscriptionPayment" ADD CONSTRAINT "OrganizationSubscriptionPayment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscriptionPayment" ADD CONSTRAINT "OrganizationSubscriptionPayment_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "OrganizationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscriptionPayment" ADD CONSTRAINT "OrganizationSubscriptionPayment_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscriptionEvent" ADD CONSTRAINT "OrganizationSubscriptionEvent_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscriptionEvent" ADD CONSTRAINT "OrganizationSubscriptionEvent_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "OrganizationSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscriptionEvent" ADD CONSTRAINT "OrganizationSubscriptionEvent_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "OrganizationSubscriptionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscriptionEvent" ADD CONSTRAINT "OrganizationSubscriptionEvent_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationModuleSetting" ADD CONSTRAINT "OrganizationModuleSetting_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationGuestContext" ADD CONSTRAINT "OrganizationGuestContext_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_target_staff_member_id_fkey" FOREIGN KEY ("target_staff_member_id") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUploadSession" ADD CONSTRAINT "MediaUploadSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_upload_session_id_fkey" FOREIGN KEY ("upload_session_id") REFERENCES "MediaUploadSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramNotificationDelivery" ADD CONSTRAINT "TelegramNotificationDelivery_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramNotificationDelivery" ADD CONSTRAINT "TelegramNotificationDelivery_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "OrganizationNotificationTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramNotificationDelivery" ADD CONSTRAINT "TelegramNotificationDelivery_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
