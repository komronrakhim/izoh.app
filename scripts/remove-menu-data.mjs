import { readdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Client } from "pg";

const menuAssetKind = "MENU_ITEM_PHOTO";
const addMenuMigration = "20260824120000_add_menu";
const removeMenuMigration = "20260918070000_remove_qr_menu";
const localMediaBucket = "local-dev";
const localMediaRoot = resolve(process.cwd(), ".tmp", "izoh-media");
const trackedMenuKeyPattern = /^org\/[A-Za-z0-9_-]+\/menu\/[A-Za-z0-9._-]+$/;
const anyMenuKeyPattern = /^org\/[^/]+\/menu\/.+$/;

const getRequiredEnv = (key) => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required to remove QR Menu storage.`);
  }

  return value;
};

const getR2Config = () => ({
  accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
  accountId: getRequiredEnv("R2_ACCOUNT_ID"),
  bucket: getRequiredEnv("R2_BUCKET"),
  secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY")
});

let r2Client;

const getR2Client = () => {
  if (r2Client) return r2Client;

  const config = getR2Config();
  r2Client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    region: "auto"
  });

  return r2Client;
};

const deleteLocalObject = async (storageKey) => {
  if (!trackedMenuKeyPattern.test(storageKey)) {
    throw new Error("Refusing to remove an unexpected local QR Menu storage key.");
  }

  const filePath = resolve(localMediaRoot, ...storageKey.split("/"));

  if (!filePath.startsWith(`${localMediaRoot}${sep}`)) {
    throw new Error("Refusing to remove a QR Menu object outside local media storage.");
  }

  await Promise.all([rm(filePath, { force: true }), rm(`${filePath}.json`, { force: true })]);
};

const deleteR2Object = async (bucket, storageKey) => {
  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey
    })
  );
};

const runWithConcurrency = async (items, concurrency, operation) => {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  const results = await Promise.allSettled(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;

        await operation(item);
      }
    })
  );
  const failure = results.find((result) => result.status === "rejected");

  if (failure?.status === "rejected") {
    throw failure.reason;
  }
};

const assertProductionExecutionContext = () => {
  if (process.env.NODE_ENV !== "production") return;

  const environmentName = process.env.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();
  const serviceName = process.env.RAILWAY_SERVICE_NAME?.trim().toLowerCase();

  if (environmentName !== "production") {
    throw new Error("Refusing QR Menu cleanup outside the Railway production environment.");
  }

  if (!serviceName?.includes("api")) {
    throw new Error("Refusing QR Menu cleanup outside the production API service.");
  }
};

const listR2MenuKeys = async (bucket) => {
  const keys = [];
  let continuationToken;

  do {
    const page = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
        Prefix: "org/"
      })
    );

    for (const item of page.Contents ?? []) {
      if (item.Key && anyMenuKeyPattern.test(item.Key)) {
        keys.push(item.Key);
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;

    if (page.IsTruncated && !continuationToken) {
      throw new Error("R2 returned a truncated object listing without a continuation token.");
    }
  } while (continuationToken);

  return keys;
};

const getTablePresence = async (client) => {
  const result = await client.query(`
    SELECT
      to_regclass('"MediaAsset"') IS NOT NULL AS media_asset,
      to_regclass('"Menu"') IS NOT NULL AS menu,
      to_regclass('"MenuCategory"') IS NOT NULL AS menu_category,
      to_regclass('"MenuItem"') IS NOT NULL AS menu_item,
      to_regclass('"OrganizationModuleSetting"') IS NOT NULL AS module_setting,
      to_regclass('"Organization"') IS NOT NULL AS organization,
      to_regclass('"StaffMember"') IS NOT NULL AS staff_member,
      to_regclass('"SubmissionAttachment"') IS NOT NULL AS submission_attachment
  `);

  return result.rows[0];
};

const getCleanupDecision = async (client) => {
  const migrationTable = (
    await client.query(`SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS present`)
  ).rows[0]?.present;

  if (!migrationTable) {
    return { reason: "migration history is not initialized", shouldRun: false };
  }

  const appliedMigrations = new Set(
    (
      await client.query(
        `
          SELECT "migration_name"
          FROM "_prisma_migrations"
          WHERE "migration_name" = ANY($1::text[])
            AND "finished_at" IS NOT NULL
            AND "rolled_back_at" IS NULL
        `,
        [[addMenuMigration, removeMenuMigration]]
      )
    ).rows.map((row) => row.migration_name)
  );

  if (appliedMigrations.has(removeMenuMigration)) {
    return { reason: "removal migration is already applied", shouldRun: false };
  }

  if (!appliedMigrations.has(addMenuMigration)) {
    return { reason: "QR Menu migration was never applied", shouldRun: false };
  }

  return { reason: "QR Menu removal migration is pending", shouldRun: true };
};

const readPreflight = async (client, tables) => {
  const counts = {
    categories: 0,
    items: 0,
    menuSettings: 0,
    menus: 0,
    photoAssets: 0
  };

  if (tables.menu) {
    counts.menus = Number((await client.query(`SELECT count(*) FROM "Menu"`)).rows[0].count);
  }

  if (tables.menu_category) {
    counts.categories = Number(
      (await client.query(`SELECT count(*) FROM "MenuCategory"`)).rows[0].count
    );
  }

  if (tables.menu_item) {
    counts.items = Number((await client.query(`SELECT count(*) FROM "MenuItem"`)).rows[0].count);
  }

  if (tables.module_setting) {
    counts.menuSettings = Number(
      (
        await client.query(
          `SELECT count(*) FROM "OrganizationModuleSetting" WHERE "module"::text = 'MENU'`
        )
      ).rows[0].count
    );
  }

  if (tables.media_asset) {
    counts.photoAssets = Number(
      (
        await client.query(`SELECT count(*) FROM "MediaAsset" WHERE "kind"::text = $1`, [
          menuAssetKind
        ])
      ).rows[0].count
    );
  }

  console.log("QR Menu removal preflight", counts);
};

const getTrackedAssets = async (client, tables) => {
  if (!tables.media_asset) return [];

  if (tables.submission_attachment) {
    const linkedCount = Number(
      (
        await client.query(
          `
            SELECT count(*)
            FROM "SubmissionAttachment" AS attachment
            JOIN "MediaAsset" AS asset ON asset."id" = attachment."media_asset_id"
            WHERE asset."kind"::text = $1
          `,
          [menuAssetKind]
        )
      ).rows[0].count
    );

    if (linkedCount > 0) {
      throw new Error("Refusing to remove QR Menu photos linked to feedback submissions.");
    }
  }

  if (tables.organization) {
    const logoReferenceCount = Number(
      (
        await client.query(
          `
            SELECT count(*)
            FROM "Organization" AS organization
            JOIN "MediaAsset" AS asset ON asset."id" = organization."logo_media_asset_id"
            WHERE asset."kind"::text = $1
          `,
          [menuAssetKind]
        )
      ).rows[0].count
    );

    if (logoReferenceCount > 0) {
      throw new Error("Refusing to remove a QR Menu photo used as an organization logo.");
    }
  }

  if (tables.staff_member) {
    const avatarReferenceCount = Number(
      (
        await client.query(
          `
            SELECT count(*)
            FROM "StaffMember" AS staff
            JOIN "MediaAsset" AS asset ON asset."id" = staff."avatar_media_asset_id"
            WHERE asset."kind"::text = $1
          `,
          [menuAssetKind]
        )
      ).rows[0].count
    );

    if (avatarReferenceCount > 0) {
      throw new Error("Refusing to remove a QR Menu photo used as a staff avatar.");
    }
  }

  const unexpectedCount = Number(
    (
      await client.query(
        `
          SELECT count(*)
          FROM "MediaAsset"
          WHERE "kind"::text = $1
            AND (
              "owner_type"::text <> 'ORGANIZATION'
              OR "storage_key" !~ '^org/[A-Za-z0-9_-]+/menu/[A-Za-z0-9._-]+$'
            )
        `,
        [menuAssetKind]
      )
    ).rows[0].count
  );

  if (unexpectedCount > 0) {
    throw new Error("Refusing to remove QR Menu photos with unexpected ownership or storage keys.");
  }

  return (
    await client.query(
      `
        SELECT "id", "bucket", "storage_key"
        FROM "MediaAsset"
        WHERE "kind"::text = $1
        ORDER BY "id"
      `,
      [menuAssetKind]
    )
  ).rows;
};

const removeTrackedAssets = async (client, assets) => {
  await runWithConcurrency(assets, 8, async (asset) => {
    if (asset.bucket === localMediaBucket) {
      await deleteLocalObject(asset.storage_key);
    } else {
      await deleteR2Object(asset.bucket, asset.storage_key);
    }

    await client.query(`DELETE FROM "MediaAsset" WHERE "id" = $1 AND "kind"::text = $2`, [
      asset.id,
      menuAssetKind
    ]);
  });
};

const removeOrphanedR2Objects = async (buckets) => {
  let removedCount = 0;

  for (const bucket of buckets) {
    const menuKeys = await listR2MenuKeys(bucket);
    await runWithConcurrency(menuKeys, 8, (storageKey) => deleteR2Object(bucket, storageKey));
    removedCount += menuKeys.length;
  }

  return removedCount;
};

const removeOrphanedLocalObjects = async () => {
  const organizationsRoot = resolve(localMediaRoot, "org");
  let organizations;

  try {
    organizations = await readdir(organizationsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }

  let removedCount = 0;

  for (const organization of organizations) {
    if (!organization.isDirectory()) continue;

    const menuDirectory = resolve(organizationsRoot, organization.name, "menu");

    try {
      const entries = await readdir(menuDirectory, { withFileTypes: true });
      removedCount += entries.filter(
        (entry) => entry.isFile() && !entry.name.endsWith(".json")
      ).length;
      await rm(menuDirectory, { force: true, recursive: true });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  return removedCount;
};

const assertNoTrackedAssetsRemain = async (client, tables) => {
  if (!tables.media_asset) return;

  const remaining = Number(
    (
      await client.query(`SELECT count(*) FROM "MediaAsset" WHERE "kind"::text = $1`, [
        menuAssetKind
      ])
    ).rows[0].count
  );

  if (remaining > 0) {
    throw new Error("QR Menu photo records remain after storage cleanup.");
  }
};

const main = async () => {
  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    const cleanupDecision = await getCleanupDecision(client);

    if (!cleanupDecision.shouldRun) {
      console.log("QR Menu storage cleanup skipped", { reason: cleanupDecision.reason });
      return;
    }

    assertProductionExecutionContext();

    const tables = await getTablePresence(client);
    await readPreflight(client, tables);

    const assets = await getTrackedAssets(client, tables);
    const configuredBucket = process.env.R2_BUCKET?.trim();
    const r2Buckets = new Set(
      assets.map((asset) => asset.bucket).filter((bucket) => bucket && bucket !== localMediaBucket)
    );

    if (configuredBucket) {
      r2Buckets.add(configuredBucket);
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("R2_BUCKET is required to audit orphaned QR Menu objects in production.");
    }

    await removeTrackedAssets(client, assets);
    const orphanedObjectsRemoved = await removeOrphanedR2Objects([...r2Buckets]);
    const orphanedLocalObjectsRemoved = await removeOrphanedLocalObjects();
    await assertNoTrackedAssetsRemain(client, tables);

    console.log("QR Menu storage cleanup finished", {
      orphanedLocalObjectsRemoved,
      orphanedObjectsRemoved,
      trackedAssetsRemoved: assets.length
    });
  } finally {
    await client.end();
    r2Client?.destroy();
  }
};

main().catch((error) => {
  console.error(`QR Menu storage cleanup failed: ${error.message}`);
  process.exit(1);
});
