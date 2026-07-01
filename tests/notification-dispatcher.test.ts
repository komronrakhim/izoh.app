import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { processTelegramNotificationDelivery } from "~/server/notification-dispatcher/deliveries";
import { sendTelegramNotificationDelivery } from "~/server/telegram";

vi.mock("~/server/domain/notification-settings", () => ({
  markTelegramGroupDisconnectedByChatId: vi.fn()
}));

vi.mock("~/server/telegram", () => {
  class TelegramPermanentDeliveryError extends Error {}

  return {
    sendTelegramNotificationDelivery: vi.fn(),
    TelegramPermanentDeliveryError
  };
});

const sendTelegramNotificationDeliveryMock = vi.mocked(sendTelegramNotificationDelivery);

describe("notification dispatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T10:00:00.000Z"));
    sendTelegramNotificationDeliveryMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules a retry for temporary Telegram delivery errors", async () => {
    const update = vi.fn(async ({ data }) => ({
      id: "delivery_1",
      ...data
    }));
    const db = {
      telegramNotificationDelivery: {
        findUnique: vi.fn(async () => ({
          attempt_count: 2
        })),
        update
      }
    } as never;
    const error = Object.assign(new Error("Too many requests"), {
      parameters: {
        retry_after: 120
      }
    });

    sendTelegramNotificationDeliveryMock.mockRejectedValueOnce(error);

    await processTelegramNotificationDelivery(db, "delivery_1", {
      maxAttempts: 5
    });

    expect(update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        error: "Too many requests",
        locked_until: null,
        next_attempt_at: new Date("2026-07-01T10:02:00.000Z"),
        status: "PENDING"
      }),
      where: {
        id: "delivery_1"
      }
    });
  });
});
