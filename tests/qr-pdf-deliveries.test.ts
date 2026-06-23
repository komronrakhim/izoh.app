import { describe, expect, it, vi } from "vitest";
import { Prisma } from "../prisma/generated/prisma/client";

import { createQrPdfDeliveryAttempt } from "~/server/domain/qr-pdf-deliveries";

const createDelivery = (status: "FAILED" | "PROCESSING" | "SENT" = "PROCESSING") => ({
  client_request_id: "qr-pdf-request-1",
  created_at: new Date("2026-06-23T00:00:00.000Z"),
  error: null,
  failed_at: null,
  file_name: "qr-local-stol-5.pdf",
  id: "delivery_1",
  organization_id: "org_1",
  sent_at: status === "SENT" ? new Date("2026-06-23T00:00:01.000Z") : null,
  status,
  telegram_message_id: status === "SENT" ? 42 : null,
  updated_at: new Date("2026-06-23T00:00:00.000Z"),
  user_id: "user_1"
});

describe("QR PDF deliveries", () => {
  it("returns the existing delivery for a repeated request id", async () => {
    const existingDelivery = createDelivery("SENT");
    const deliveryCreate = vi.fn();
    const db = {
      qrPdfDelivery: {
        create: deliveryCreate,
        findFirst: vi.fn(async () => existingDelivery)
      }
    } as never;

    await expect(
      createQrPdfDeliveryAttempt(
        {
          clientRequestId: "qr-pdf-request-1",
          fileName: "qr-local-stol-5.pdf",
          organizationId: "org_1",
          userId: "user_1"
        },
        db
      )
    ).resolves.toEqual({
      created: false,
      delivery: existingDelivery
    });

    expect(deliveryCreate).not.toHaveBeenCalled();
  });

  it("returns the concurrent delivery when the idempotency key is already being created", async () => {
    const duplicateRequestError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`client_request_id`)",
      {
        clientVersion: "test",
        code: "P2002",
        meta: {
          target: ["client_request_id"]
        }
      }
    );
    const concurrentDelivery = createDelivery("PROCESSING");
    const deliveryCreate = vi.fn(async () => {
      throw duplicateRequestError;
    });
    const db = {
      qrPdfDelivery: {
        create: deliveryCreate,
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(concurrentDelivery)
      }
    } as never;

    await expect(
      createQrPdfDeliveryAttempt(
        {
          clientRequestId: "qr-pdf-request-1",
          fileName: "qr-local-stol-5.pdf",
          organizationId: "org_1",
          userId: "user_1"
        },
        db
      )
    ).resolves.toEqual({
      created: false,
      delivery: concurrentDelivery
    });

    expect(deliveryCreate).toHaveBeenCalledTimes(1);
  });
});
