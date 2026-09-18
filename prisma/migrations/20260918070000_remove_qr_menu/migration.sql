BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '15min';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "MediaAsset"
    WHERE "kind"::text = 'MENU_ITEM_PHOTO'
  ) THEN
    RAISE EXCEPTION 'MENU_ITEM_PHOTO assets must be removed before the QR Menu schema';
  END IF;
END
$$;

DELETE FROM "OrganizationModuleSetting"
WHERE "module"::text = 'MENU';

DROP TABLE "MenuItem";
DROP TABLE "MenuCategory";
DROP TABLE "Menu";

CREATE TYPE "OrganizationModule_new" AS ENUM (
  'REVIEW',
  'COMPLAINT',
  'SUGGESTION',
  'STAFF'
);

ALTER TABLE "OrganizationModuleSetting"
  ALTER COLUMN "module" TYPE "OrganizationModule_new"
  USING ("module"::text::"OrganizationModule_new");

ALTER TYPE "OrganizationModule" RENAME TO "OrganizationModule_old";
ALTER TYPE "OrganizationModule_new" RENAME TO "OrganizationModule";
DROP TYPE "OrganizationModule_old";

CREATE TYPE "MediaAssetKind_new" AS ENUM (
  'ORGANIZATION_LOGO',
  'STAFF_AVATAR',
  'SUBMISSION_PHOTO',
  'SUBMISSION_THUMBNAIL'
);

ALTER TABLE "MediaAsset"
  ALTER COLUMN "kind" TYPE "MediaAssetKind_new"
  USING ("kind"::text::"MediaAssetKind_new");

ALTER TYPE "MediaAssetKind" RENAME TO "MediaAssetKind_old";
ALTER TYPE "MediaAssetKind_new" RENAME TO "MediaAssetKind";
DROP TYPE "MediaAssetKind_old";

COMMIT;
