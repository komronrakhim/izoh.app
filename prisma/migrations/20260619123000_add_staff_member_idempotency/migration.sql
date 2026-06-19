ALTER TABLE "StaffMember"
ADD COLUMN "creation_client_request_id" TEXT;

CREATE UNIQUE INDEX "StaffMember_creation_client_request_id_key"
ON "StaffMember"("creation_client_request_id");
