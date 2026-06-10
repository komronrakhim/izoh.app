import { describe, expect, it } from "vitest";

import { createApiApp } from "~/server/api/app";

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

describe("admin organizations API", () => {
  it("requires a database for admin organizations", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const response = await createApiApp().request("/api/admin/organizations");
    const payload = (await response.json()) as { error: string };

    restoreEnv("DATABASE_URL", databaseUrl);

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("requires a database to create organizations", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const response = await createApiApp().request("/api/admin/organizations", {
      body: JSON.stringify({
        locale: "RU",
        name: "Coffee Place"
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const payload = (await response.json()) as { error: string };

    restoreEnv("DATABASE_URL", databaseUrl);

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("allows Telegram init data in CORS preflight", async () => {
    const response = await createApiApp().request("/api/admin/organizations", {
      headers: {
        "Access-Control-Request-Headers": "X-Telegram-Init-Data",
        "Access-Control-Request-Method": "GET",
        Origin: "https://app.izoh.test"
      },
      method: "OPTIONS"
    });

    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("X-Telegram-Init-Data");
  });

  it("requires a database for QR template links", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const response = await createApiApp().request(
      "/api/organizations/org_1/qr-link?context=%D0%A1%D1%82%D0%BE%D0%BB%204"
    );
    const payload = (await response.json()) as { error: string };

    restoreEnv("DATABASE_URL", databaseUrl);

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });
});
