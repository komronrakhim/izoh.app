import "dotenv/config";

import { getPrisma } from "~/server/db";
import { processPendingQrPdfDeliveriesOnce } from "./deliveries";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readNumberEnv = (key: string, fallback: number) => {
  const value = Number(process.env[key] ?? "");

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const pollMs = readNumberEnv("QR_PDF_DISPATCHER_POLL_MS", 2000);
const batchSize = readNumberEnv("QR_PDF_DISPATCHER_BATCH_SIZE", 3);
const lockMs = readNumberEnv("QR_PDF_DISPATCHER_LOCK_MS", 60_000);
const maxAttempts = readNumberEnv("QR_PDF_DISPATCHER_MAX_ATTEMPTS", 5);

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

  console.log(`QR PDF Dispatcher started. batch=${batchSize} pollMs=${pollMs} maxAttempts=${maxAttempts}`);

  while (!stopping) {
    try {
      const processedCount = await processPendingQrPdfDeliveriesOnce(db, {
        batchSize,
        lockMs,
        maxAttempts
      });

      if (processedCount === 0) {
        await sleep(pollMs);
      }
    } catch (error) {
      console.error(
        error instanceof Error ? `QR PDF Dispatcher error: ${error.message}` : "QR PDF Dispatcher failed."
      );
      await sleep(pollMs);
    }
  }

  await db.$disconnect();
  console.log("QR PDF Dispatcher stopped.");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "QR PDF Dispatcher failed.");
  process.exit(1);
});
