import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApiApp } from "~/server/api/app";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("staff members API", () => {
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

  it("requires a database to list staff members", async () => {
    const response = await createApiApp().request("/api/organizations/org_1/staff-members");
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("requires a database to create staff members", async () => {
    const response = await createApiApp().request("/api/organizations/org_1/staff-members", {
      body: JSON.stringify({
        displayName: "Aziza",
        roleTitle: "Администратор"
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

  it("requires a database to read one staff member", async () => {
    const response = await createApiApp().request("/api/organizations/org_1/staff-members/staff_1");
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("requires a database to update staff members", async () => {
    const response = await createApiApp().request(
      "/api/organizations/org_1/staff-members/staff_1",
      {
        body: JSON.stringify({
          roleTitle: "Бариста"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      }
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("requires a database to delete staff members", async () => {
    const response = await createApiApp().request(
      "/api/organizations/org_1/staff-members/staff_1",
      {
        method: "DELETE"
      }
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });
});
