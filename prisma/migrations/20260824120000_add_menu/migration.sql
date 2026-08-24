BEGIN;

ALTER TYPE "OrganizationModule" ADD VALUE 'MENU';

ALTER TYPE "MediaAssetKind" ADD VALUE 'MENU_ITEM_PHOTO';

CREATE TABLE "Menu" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "content_locale" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Menu_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Menu_currency_code_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Menu_revision_check" CHECK ("revision" >= 1)
);

CREATE TABLE "MenuCategory" (
  "id" TEXT NOT NULL,
  "menu_id" TEXT NOT NULL,
  "creation_client_request_id" TEXT,
  "name" TEXT NOT NULL,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MenuCategory_sort_order_check" CHECK ("sort_order" >= 0)
);

CREATE TABLE "MenuItem" (
  "id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "creation_client_request_id" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "portion_label" TEXT NOT NULL DEFAULT '',
  "price_minor" INTEGER NOT NULL,
  "photo_media_asset_id" TEXT,
  "is_visible" BOOLEAN NOT NULL DEFAULT true,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  "spice_level" INTEGER NOT NULL DEFAULT 0,
  "dietary_tag_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "marketing_tag_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allergen_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MenuItem_price_minor_check" CHECK ("price_minor" >= 0),
  CONSTRAINT "MenuItem_spice_level_check" CHECK ("spice_level" BETWEEN 0 AND 3),
  CONSTRAINT "MenuItem_sort_order_check" CHECK ("sort_order" >= 0)
);

CREATE UNIQUE INDEX "Menu_organization_id_key" ON "Menu"("organization_id");
CREATE UNIQUE INDEX "MenuCategory_creation_client_request_id_key" ON "MenuCategory"("creation_client_request_id");
CREATE INDEX "MenuCategory_menu_id_is_visible_sort_order_idx" ON "MenuCategory"("menu_id", "is_visible", "sort_order");
CREATE UNIQUE INDEX "MenuItem_creation_client_request_id_key" ON "MenuItem"("creation_client_request_id");
CREATE UNIQUE INDEX "MenuItem_photo_media_asset_id_key" ON "MenuItem"("photo_media_asset_id");
CREATE INDEX "MenuItem_category_id_is_visible_sort_order_idx" ON "MenuItem"("category_id", "is_visible", "sort_order");
CREATE INDEX "MenuItem_photo_media_asset_id_idx" ON "MenuItem"("photo_media_asset_id");

ALTER TABLE "Menu"
  ADD CONSTRAINT "Menu_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuCategory"
  ADD CONSTRAINT "MenuCategory_menu_id_fkey"
  FOREIGN KEY ("menu_id") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_photo_media_asset_id_fkey"
  FOREIGN KEY ("photo_media_asset_id") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
