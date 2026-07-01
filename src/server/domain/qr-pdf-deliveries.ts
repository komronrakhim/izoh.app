import { Prisma } from "../../../prisma/generated/prisma/client";

import { type DomainDb, getDomainDb } from "~/server/domain/shared";

const normalizeOptionalString = (value: string | undefined) => {
  const normalized = value?.replace(/\s+/g, " ").trim();

  return normalized || undefined;
};

const isUniqueConstraintError = (error: unknown, fieldName: string) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes(fieldName);
  }

  return typeof target === "string" && target.includes(fieldName);
};

const getExistingDelivery = async (
  {
    clientRequestId,
    organizationId,
    userId
  }: {
    clientRequestId: string;
    organizationId: string;
    userId: string;
  },
  db: DomainDb
) =>
  db.qrPdfDelivery.findFirst({
    where: {
      client_request_id: clientRequestId,
      organization_id: organizationId,
      user_id: userId
    }
  });

export const createQrPdfDeliveryAttempt = async (
  {
    clientRequestId,
    fileName,
    organizationId,
    startParam,
    template,
    userId
  }: {
    clientRequestId: string | undefined;
    fileName: string;
    organizationId: string;
    startParam?: string;
    template?: Prisma.InputJsonValue;
    userId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const cleanClientRequestId = normalizeOptionalString(clientRequestId);

  if (!cleanClientRequestId) {
    throw new Error("QR PDF request id is required.");
  }

  const existingDelivery = await getExistingDelivery(
    {
      clientRequestId: cleanClientRequestId,
      organizationId,
      userId
    },
    db
  );

  if (existingDelivery) {
    return {
      created: false,
      delivery: existingDelivery
    };
  }

  try {
    const delivery = await db.qrPdfDelivery.create({
      data: {
        client_request_id: cleanClientRequestId,
        file_name: fileName,
        organization_id: organizationId,
        start_param: startParam,
        template,
        user_id: userId
      }
    });

    return {
      created: true,
      delivery
    };
  } catch (error) {
    if (!isUniqueConstraintError(error, "client_request_id")) {
      throw error;
    }

    const concurrentDelivery = await getExistingDelivery(
      {
        clientRequestId: cleanClientRequestId,
        organizationId,
        userId
      },
      db
    );

    if (concurrentDelivery) {
      return {
        created: false,
        delivery: concurrentDelivery
      };
    }

    throw error;
  }
};
