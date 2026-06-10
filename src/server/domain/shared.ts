import type { Prisma, PrismaClient } from "../../../prisma/generated/prisma/client";
import { getPrisma } from "~/server/db";

export type DomainDb = PrismaClient | Prisma.TransactionClient;

export const getDomainDb = () => {
  const db = getPrisma();

  if (!db) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return db;
};
