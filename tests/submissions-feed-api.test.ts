import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApiApp } from "~/server/api/app";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("submissions feed API", () => {
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

  it("requires a database for submissions feed", async () => {
    const response = await createApiApp().request("/api/organizations/org_1/submissions");
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });
});
