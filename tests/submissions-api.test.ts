import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApiApp } from "~/server/api/app";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("submissions API", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
      return;
    }

    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("requires a database to create submissions", async () => {
    const response = await createApiApp().request("/api/submissions", {
      body: JSON.stringify({
        bodyText: "Все хорошо",
        clientRequestId: "submission-request-1",
        kind: "REVIEW",
        locale: "ru",
        organizationId: "org_1",
        rating: 5,
        startParam: "coffee-place"
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });
});
