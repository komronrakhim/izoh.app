import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../prisma/generated/prisma/client";

declare global {
  var izohPrismaPoolGlobal: Pool | undefined;
  var izohPrismaGlobal: PrismaClient | undefined;
}

const readPositiveIntegerEnv = (key: string, fallback: number) => {
  const value = Number(process.env[key] ?? "");

  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const createPrismaClient = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return null;
  }

  const pool =
    globalThis.izohPrismaPoolGlobal ??
    (globalThis.izohPrismaPoolGlobal = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: readPositiveIntegerEnv("DATABASE_POOL_CONNECT_TIMEOUT_MS", 5_000),
      idleTimeoutMillis: readPositiveIntegerEnv("DATABASE_POOL_IDLE_TIMEOUT_MS", 30_000),
      max: readPositiveIntegerEnv("DATABASE_POOL_MAX", 10)
    }));

  const client =
    globalThis.izohPrismaGlobal ??
    (globalThis.izohPrismaGlobal = new PrismaClient({
      adapter: new PrismaPg(pool),
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    }));

  return client;
};

export const getPrisma = () => createPrismaClient();
