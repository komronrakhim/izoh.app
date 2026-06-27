-- CreateTable
CREATE TABLE "ExternalReviewClick" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "guest_entry_scan_id" TEXT,
    "link_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "target_host" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalReviewClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalReviewClick_organization_id_created_at_idx" ON "ExternalReviewClick"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ExternalReviewClick_organization_id_provider_created_at_idx" ON "ExternalReviewClick"("organization_id", "provider", "created_at");

-- CreateIndex
CREATE INDEX "ExternalReviewClick_submission_id_created_at_idx" ON "ExternalReviewClick"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "ExternalReviewClick_guest_entry_scan_id_created_at_idx" ON "ExternalReviewClick"("guest_entry_scan_id", "created_at");

-- AddForeignKey
ALTER TABLE "ExternalReviewClick" ADD CONSTRAINT "ExternalReviewClick_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReviewClick" ADD CONSTRAINT "ExternalReviewClick_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReviewClick" ADD CONSTRAINT "ExternalReviewClick_guest_entry_scan_id_fkey" FOREIGN KEY ("guest_entry_scan_id") REFERENCES "GuestEntryScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
