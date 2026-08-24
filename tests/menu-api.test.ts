import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiApp } from "~/server/api/app";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalNodeEnv = process.env.NODE_ENV;
const originalPrisma = globalThis.izohPrismaGlobal;
const originalPrismaPool = globalThis.izohPrismaPoolGlobal;
const activeSubscription = {
  cancel_at_period_end: false,
  current_period_ends_at: new Date("2099-01-01T00:00:00.000Z"),
  current_period_started_at: new Date("2026-01-01T00:00:00.000Z"),
  plan_code: "MONTHLY",
  source: "TELEGRAM_STARS",
  status: "ACTIVE",
  trial_ends_at: null,
  trial_started_at: null
};

const restoreValue = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
};

describe("menu API", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    restoreValue("DATABASE_URL", originalDatabaseUrl);
    restoreValue("NODE_ENV", originalNodeEnv);
    globalThis.izohPrismaGlobal = originalPrisma;
    globalThis.izohPrismaPoolGlobal = originalPrismaPool;
  });

  it("registers the admin menu endpoint and requires a database", async () => {
    const response = await createApiApp().request("/api/organizations/org_1/menu");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Database is required." });
  });

  it("returns only the owner menu summary shape and scopes it to the route tenant", async () => {
    const findFirst = vi.fn(async () => ({
      id: "org_summary",
      menu: { categories: [{ id: "category_1" }] },
      module_settings: [{ enabled: true }],
      subscription: activeSubscription
    }));

    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/izoh_test";
    process.env.NODE_ENV = "test";
    globalThis.izohPrismaPoolGlobal = {} as never;
    globalThis.izohPrismaGlobal = {
      organization: { findFirst }
    } as never;

    const response = await createApiApp().request("/api/organizations/org_summary/menu/summary");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      guestAvailable: true,
      moduleEnabled: true,
      organizationId: "org_summary"
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "org_summary", status: "ACTIVE" }
      })
    );
  });

  it("requires owner authentication for the summary endpoint in production", async () => {
    const findFirst = vi.fn();

    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/izoh_test";
    process.env.NODE_ENV = "production";
    globalThis.izohPrismaPoolGlobal = {} as never;
    globalThis.izohPrismaGlobal = {
      organization: { findFirst }
    } as never;

    const response = await createApiApp().request("/api/organizations/org_summary/menu/summary");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Telegram init data is required."
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("registers the full guest menu endpoint without falling through to guest boot", async () => {
    const response = await createApiApp().request("/api/guest-entry/coffee-place/menu");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Database is required." });
  });

  it("applies a coarse client limit across syntactically valid organization refs", async () => {
    const app = createApiApp();
    const clientAddress = "203.0.113.77";
    let response: Response | undefined;

    for (let index = 0; index <= 300; index += 1) {
      response = await app.request(`/api/guest-entry/random-${index}/menu`, {
        headers: { "cf-connecting-ip": clientAddress }
      });
    }

    expect(response?.status).toBe(429);
    await expect(response!.json()).resolves.toEqual({
      error: "Too many requests. Please try again later."
    });
  });

  it("keeps the shared rate-limit store bounded under high-cardinality traffic", async () => {
    const app = createApiApp();
    const anchorHeaders = { "cf-connecting-ip": "198.51.100.1" };

    await app.request("/api/guest-entry/capacity-anchor/menu", { headers: anchorHeaders });

    for (let index = 0; index < 2601; index += 1) {
      const thirdOctet = Math.floor(index / 256);
      const fourthOctet = index % 256;

      await app.request(`/api/guest-entry/capacity-${index}/menu`, {
        headers: { "cf-connecting-ip": `198.18.${thirdOctet}.${fourthOctet}` }
      });
    }

    let response: Response | undefined;

    for (let index = 0; index < 180; index += 1) {
      response = await app.request("/api/guest-entry/capacity-anchor/menu", {
        headers: anchorHeaders
      });
    }

    expect(response?.status).toBe(503);

    response = await app.request("/api/guest-entry/capacity-anchor/menu", {
      headers: anchorHeaders
    });
    expect(response.status).toBe(429);
  });

  it("rate-limits guest menu contexts by IP and organization instead of attacker-controlled context", async () => {
    const app = createApiApp();
    const headers = { "x-forwarded-for": "198.51.100.81" };

    for (let index = 0; index < 180; index += 1) {
      const contextCode = `c${index.toString(36).padStart(3, "0")}`;
      const response = await app.request(`/api/guest-entry/rate-limit-org__${contextCode}/menu`, {
        headers
      });

      expect(response.status).toBe(503);
    }

    const limited = await app.request("/api/guest-entry/rate-limit-org__c999/menu", { headers });

    expect(limited.status).toBe(429);
  });

  it("uses one bounded guest menu rate bucket for malformed start params", async () => {
    const app = createApiApp();
    const headers = { "x-forwarded-for": "198.51.100.82" };

    for (let index = 0; index < 180; index += 1) {
      const malformed = encodeURIComponent(`invalid__UPPER${index}`);
      const response = await app.request(`/api/guest-entry/${malformed}/menu`, { headers });

      expect(response.status).toBe(503);
    }

    const limited = await app.request("/api/guest-entry/invalid__STILL-BAD/menu", { headers });

    expect(limited.status).toBe(429);
  });

  it("registers atomic category reorder", async () => {
    const response = await createApiApp().request(
      "/api/organizations/org_1/menu/categories/reorder",
      {
        body: JSON.stringify({ orderedIds: ["category_2", "category_1"] }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );

    expect(response.status).toBe(503);
  });

  it("registers detached menu photo cleanup", async () => {
    const response = await createApiApp().request("/api/organizations/org_1/menu/photos/photo_1", {
      method: "DELETE"
    });

    expect(response.status).toBe(503);
  });
});
