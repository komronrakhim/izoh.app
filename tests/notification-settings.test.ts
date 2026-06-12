import { describe, expect, it } from "vitest";

import { createApiApp, parseTelegramGroupConnectTokenCommand } from "~/server/api/app";
import {
  isImportantSubmission,
  parseNotificationTargetPatch,
  shouldSendNotificationToTarget
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

    const response = await createApiApp().request("/api/organizations/org_1/notifications");
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
    expect(
      shouldSendNotificationToTarget(
        {
          complaintEnabled: true,
          mode: "ALL",
          reviewEnabled: true,
          status: "ACTIVE",
          suggestionEnabled: true,
          type: "OWNER_DM"
        },
        { kind: "SUGGESTION" }
      )
    ).toBe(true);
    expect(
      shouldSendNotificationToTarget(
        {
          complaintEnabled: true,
          mode: "OFF",
          reviewEnabled: true,
          status: "ACTIVE",
          suggestionEnabled: true,
          type: "OWNER_DM"
        },
        { kind: "COMPLAINT" }
      )
    ).toBe(false);
    expect(
      shouldSendNotificationToTarget(
        {
          complaintEnabled: true,
          mode: "IMPORTANT_ONLY",
          reviewEnabled: true,
          status: "ACTIVE",
          suggestionEnabled: true,
          type: "OWNER_DM"
        },
        { kind: "REVIEW", rating: 2 }
      )
    ).toBe(true);
    expect(
      shouldSendNotificationToTarget(
        {
          complaintEnabled: true,
          mode: "IMPORTANT_ONLY",
          reviewEnabled: true,
          status: "ACTIVE",
          suggestionEnabled: true,
          type: "OWNER_DM"
        },
        { kind: "SUGGESTION" }
      )
    ).toBe(false);
  });

  it("respects enabled submission types per target", () => {
    expect(
      shouldSendNotificationToTarget(
        {
          complaintEnabled: true,
          mode: "ALL",
          reviewEnabled: false,
          status: "ACTIVE",
          suggestionEnabled: true,
          type: "TELEGRAM_GROUP"
        },
        { kind: "REVIEW", rating: 5 }
      )
    ).toBe(false);
  });

  it("validates target patches without accepting unknown fields", () => {
    expect(
      parseNotificationTargetPatch({
        mode: "IMPORTANT_ONLY",
        reviewEnabled: true
      }).mode
    ).toBe("IMPORTANT_ONLY");

    const parsed = parseNotificationTargetPatch({
      unexpectedField: "group",
      mode: "ALL"
    });

    expect("unexpectedField" in parsed).toBe(false);
  });

  it("does not apply importance mode to group targets", () => {
    expect(
      shouldSendNotificationToTarget(
        {
          complaintEnabled: true,
          mode: "OFF",
          reviewEnabled: true,
          status: "ACTIVE",
          suggestionEnabled: true,
          type: "TELEGRAM_GROUP"
        },
        { kind: "SUGGESTION" }
      )
    ).toBe(true);
  });

  it("accepts only startgroup connect commands", () => {
    expect(parseTelegramGroupConnectTokenCommand("/start abc123")).toBe("ABC123");
    expect(parseTelegramGroupConnectTokenCommand("/start@izohappbot abc123")).toBe("ABC123");
    expect(parseTelegramGroupConnectTokenCommand("/help abc123")).toBe(null);
  });
});
