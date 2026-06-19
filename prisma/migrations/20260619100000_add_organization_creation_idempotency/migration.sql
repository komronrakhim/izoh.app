ALTER TABLE "Organization"
ADD COLUMN "creation_client_request_id" TEXT;

CREATE UNIQUE INDEX "Organization_creation_client_request_id_key"
ON "Organization"("creation_client_request_id");
