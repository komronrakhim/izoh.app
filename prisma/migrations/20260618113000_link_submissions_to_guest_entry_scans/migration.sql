-- Link submitted guest feedback to the exact QR scan session when it is available.
ALTER TABLE "Submission" ADD COLUMN "guest_entry_scan_id" TEXT;

CREATE INDEX "Submission_guest_entry_scan_id_idx" ON "Submission"("guest_entry_scan_id");

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_guest_entry_scan_id_fkey" FOREIGN KEY ("guest_entry_scan_id") REFERENCES "GuestEntryScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
