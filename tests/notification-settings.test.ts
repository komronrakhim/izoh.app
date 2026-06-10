import { describe, expect, it } from "vitest";

import { createApiApp } from "~/server/api/app";
import {
  isImportantSubmission,
  parseNotificationSettingsPatch,
  shouldSendNotification
} from "~/shared/notifications";

const restoreDatabaseUrl = (databaseUrl: string | undefined) => {
  if (databaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = databaseUrl;
};

describe("notification settings", () => {
  it("requires a database for organization notification settings", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const response = await createApiApp().request("/api/organizations/org_1/notifications/settings");
    const payload = (await response.json()) as { error: string };

    restoreDatabaseUrl(databaseUrl);

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("treats complaints and low reviews as important", () => {
    expect(isImportantSubmission({ kind: "COMPLAINT" })).toBe(true);
    expect(isImportantSubmission({ kind: "REVIEW", rating: 3 })).toBe(true);
    expect(isImportantSubmission({ kind: "REVIEW", rating: 4 })).toBe(false);
    expect(isImportantSubmission({ kind: "SUGGESTION" })).toBe(false);
  });

  it("filters notifications by compact mode", () => {
    expect(shouldSendNotification({ mode: "ALL" }, { kind: "SUGGESTION" })).toBe(true);
    expect(shouldSendNotification({ mode: "OFF" }, { kind: "COMPLAINT" })).toBe(false);
    expect(
      shouldSendNotification({ mode: "IMPORTANT_ONLY" }, { kind: "REVIEW", rating: 2 })
    ).toBe(true);
    expect(shouldSendNotification({ mode: "IMPORTANT_ONLY" }, { kind: "SUGGESTION" })).toBe(
      false
    );
  });

  it("validates Telegram group ids as numeric strings", () => {
    expect(
      parseNotificationSettingsPatch({
        telegramGroupChatId: "-1001234567890"
      }).telegramGroupChatId
    ).toBe("-1001234567890");

    expect(() =>
      parseNotificationSettingsPatch({
        telegramGroupChatId: "telegram-group"
      })
    ).toThrow();
  });
});
