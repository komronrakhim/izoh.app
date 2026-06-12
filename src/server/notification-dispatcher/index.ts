import "dotenv/config";

import { getPrisma } from "~/server/db";
import { processPendingTelegramNotificationDeliveriesOnce } from "./deliveries";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readNumberEnv = (key: string, fallback: number) => {
  const value = Number(process.env[key] ?? "");

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const pollMs = readNumberEnv("NOTIFICATION_DISPATCHER_POLL_MS", 2000);
const batchSize = readNumberEnv("NOTIFICATION_DISPATCHER_BATCH_SIZE", 10);
const lockMs = readNumberEnv("NOTIFICATION_DISPATCHER_LOCK_MS", 60_000);
const maxAttempts = readNumberEnv("NOTIFICATION_DISPATCHER_MAX_ATTEMPTS", 5);

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
    `Notification Dispatcher started. batch=${batchSize} pollMs=${pollMs} maxAttempts=${maxAttempts}`
  );

  while (!stopping) {
    try {
      const processedCount = await processPendingTelegramNotificationDeliveriesOnce(db, {
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
          ? `Notification Dispatcher error: ${error.message}`
          : "Notification Dispatcher failed."
      );
      await sleep(pollMs);
    }
  }

  await db.$disconnect();
  console.log("Notification Dispatcher stopped.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Notification Dispatcher failed.");
  process.exit(1);
});
