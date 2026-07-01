import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  claimPendingQrPdfDeliveries,
  processQrPdfDelivery
} from "~/server/qr-pdf-dispatcher/deliveries";
import { renderOrganizationQrPdf } from "~/server/pdf";
import { getTelegramBot } from "~/server/telegram";

vi.mock("~/server/pdf", () => ({
  renderOrganizationQrPdf: vi.fn(async () => Buffer.from("%PDF test"))
}));

vi.mock("~/server/telegram", () => ({
  getTelegramBot: vi.fn(),
  getTelegramMiniAppUrl: vi.fn((startParam: string) => `https://t.me/izohappbot/app?startapp=${startParam}`)
}));

const renderOrganizationQrPdfMock = vi.mocked(renderOrganizationQrPdf);
const getTelegramBotMock = vi.mocked(getTelegramBot);

describe("QR PDF dispatcher", () => {
  beforeEach(() => {
    renderOrganizationQrPdfMock.mockClear();
    getTelegramBotMock.mockReturnValue({
      api: {
        sendDocument: vi.fn(async () => ({
          message_id: 42
        }))
      }
    } as never);
  });

  it("claims pending deliveries with a lock", async () => {
    const updateMany = vi.fn(async () => ({
      count: 1
    }));
    const db = {
      qrPdfDelivery: {
        findMany: vi.fn(async () => [{ id: "delivery_1" }]),
        updateMany
      }
    } as never;

    await expect(
      claimPendingQrPdfDeliveries(db, {
        batchSize: 5,
        lockMs: 60_000
      })
    ).resolves.toEqual(["delivery_1"]);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attempt_count: {
            increment: 1
          },
          locked_until: expect.any(Date)
        }),
        where: expect.objectContaining({
          id: "delivery_1",
          status: "PROCESSING"
        })
      })
    );
  });

  it("renders and sends a claimed delivery", async () => {
    const update = vi.fn(async ({ data }) => ({
      id: "delivery_1",
      ...data
    }));
    const sendDocument = vi.fn(async () => ({
      message_id: 77
    }));
    const db = {
      mediaAsset: {
        findFirst: vi.fn()
      },
      qrPdfDelivery: {
        findUnique: vi.fn(async () => ({
          attempt_count: 1,
          file_name: "qr-place.pdf",
          id: "delivery_1",
          organization: {
            id: "org_1",
            locale: "ru",
            logo_media_asset_id: null,
            name: "Place"
          },
          start_param: "place.table",
          template: {
            caption: "Share your impression",
            formatId: "table"
          },
          user: {
            telegram_id: BigInt(123)
          }
        })),
        update
      }
    } as never;

    getTelegramBotMock.mockReturnValue({
      api: {
        sendDocument
      }
    } as never);

    await processQrPdfDelivery(db, "delivery_1", {
      maxAttempts: 5
    });

    expect(renderOrganizationQrPdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationName: "Place",
        template: {
          caption: "Share your impression",
          formatId: "table"
        },
        url: "https://t.me/izohappbot/app?startapp=place.table"
      })
    );
    expect(sendDocument).toHaveBeenCalledWith("123", expect.anything());
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locked_until: null,
          status: "SENT",
          telegram_message_id: 77
        }),
        where: {
          id: "delivery_1"
        }
      })
    );
  });
});
