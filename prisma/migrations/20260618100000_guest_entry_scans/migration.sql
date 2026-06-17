-- CreateTable
CREATE TABLE "GuestEntryScan" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT,
    "start_param" TEXT NOT NULL,
    "qr_context" TEXT,
    "locale" TEXT,
    "platform" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestEntryScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestEntryScan_organization_id_created_at_idx" ON "GuestEntryScan"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "GuestEntryScan_user_id_created_at_idx" ON "GuestEntryScan"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "GuestEntryScan_start_param_created_at_idx" ON "GuestEntryScan"("start_param", "created_at");

-- CreateIndex
CREATE INDEX "GuestEntryScan_created_at_idx" ON "GuestEntryScan"("created_at");

-- AddForeignKey
ALTER TABLE "GuestEntryScan" ADD CONSTRAINT "GuestEntryScan_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestEntryScan" ADD CONSTRAINT "GuestEntryScan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
