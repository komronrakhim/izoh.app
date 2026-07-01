ALTER TABLE "MediaAsset" DROP CONSTRAINT IF EXISTS "MediaAsset_upload_session_id_fkey";

DROP INDEX IF EXISTS "MediaAsset_upload_session_id_idx";

ALTER TABLE "MediaAsset" DROP COLUMN IF EXISTS "upload_session_id";

DROP TABLE IF EXISTS "MediaUploadSession";

DROP TYPE IF EXISTS "MediaUploadSessionStatus";
