import "dotenv/config";

import { getPrisma } from "~/server/db";
import { processPendingOrganizationDeletionJobsOnce } from "./deletions";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readNumberEnv = (key: string, fallback: number) => {
  const value = Number(process.env[key] ?? "");

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const pollMs = readNumberEnv("ORGANIZATION_DELETION_WORKER_POLL_MS", 2000);
const batchSize = readNumberEnv("ORGANIZATION_DELETION_WORKER_BATCH_SIZE", 2);
const lockMs = readNumberEnv("ORGANIZATION_DELETION_WORKER_LOCK_MS", 60_000);
const maxAttempts = readNumberEnv("ORGANIZATION_DELETION_WORKER_MAX_ATTEMPTS", 5);

let stopping = false;

const stop = () => {
  stopping = true;
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const main = async () => {
  const db = getPrisma();

  if (!db) {
    throw new Error("DATABASE_URL is not configured.");
  }

  console.log(
    `Organization Deletion Worker started. batch=${batchSize} pollMs=${pollMs} maxAttempts=${maxAttempts}`
  );

  while (!stopping) {
    try {
      const processedCount = await processPendingOrganizationDeletionJobsOnce(db, {
        batchSize,
        lockMs,
        maxAttempts
      });

      if (processedCount === 0) {
        await sleep(pollMs);
      }
    } catch (error) {
      console.error(
        error instanceof Error
          ? `Organization Deletion Worker error: ${error.message}`
          : "Organization Deletion Worker failed."
      );
      await sleep(pollMs);
    }
  }

  await db.$disconnect();
  console.log("Organization Deletion Worker stopped.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Organization Deletion Worker failed.");
  process.exit(1);
});
