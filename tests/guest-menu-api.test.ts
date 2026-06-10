import { describe, expect, it } from "vitest";

import { createApiApp } from "~/server/api/app";

const restoreDatabaseUrl = (databaseUrl: string | undefined) => {
  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
    return;
  }

  delete process.env.DATABASE_URL;
};

describe("guest menu API", () => {
  it("allows patch requests in CORS preflight", async () => {
    const response = await createApiApp().request("/api/organizations/org_1/guest-menu/staff", {
      headers: {
        "Access-Control-Request-Method": "PATCH",
        Origin: "https://app.izoh.test"
      },
      method: "OPTIONS"
    });

    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("PATCH");
  });

  it("requires a database for guest menu settings", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const response = await createApiApp().request("/api/organizations/org_1/guest-menu");
    const payload = (await response.json()) as { error: string };

    restoreDatabaseUrl(databaseUrl);

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("requires a database to patch guest menu settings", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const response = await createApiApp().request("/api/organizations/org_1/guest-menu/staff", {
      body: JSON.stringify({ enabled: true }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "PATCH"
    });
    const payload = (await response.json()) as { error: string };

    restoreDatabaseUrl(databaseUrl);

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });
});
