import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../prisma/generated/prisma/client";

declare global {
  var izohPrismaPoolGlobal: Pool | undefined;
  var izohPrismaGlobal: PrismaClient | undefined;
}

const createPrismaClient = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return null;
  }

  const pool =
    globalThis.izohPrismaPoolGlobal ??
    (globalThis.izohPrismaPoolGlobal = new Pool({
      connectionString: databaseUrl
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
