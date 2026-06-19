ALTER TABLE "Submission"
ADD COLUMN "client_request_id" TEXT;

CREATE UNIQUE INDEX "Submission_client_request_id_key"
ON "Submission"("client_request_id");
