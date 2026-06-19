import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../prisma/generated/prisma/client";

import { createApiApp } from "~/server/api/app";
import { createOrganizationStaffMember } from "~/server/domain/staff-members";

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
        clientRequestId: "create-staff-request-1",
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

  it("returns the existing staff member for a repeated creation request", async () => {
    const staffMemberCreate = vi.fn();
    const db = {
      mediaAsset: {
        findMany: vi.fn(async () => [])
      },
      organization: {
        findUnique: vi.fn(async () => ({
          id: "org_1",
          status: "ACTIVE"
        }))
      },
      staffMember: {
        count: vi.fn(),
        create: staffMemberCreate,
        findFirst: vi.fn(async () => ({
          id: "staff_1"
        })),
        findMany: vi.fn(async () => [
          {
            avatar_media_asset_id: null,
            display_name: "Aziza",
            id: "staff_1",
            is_active: true,
            role_title: "Администратор",
            sort_order: 0
          }
        ])
      }
    } as never;

    await expect(
      createOrganizationStaffMember(
        {
          clientRequestId: "create-staff-request-1",
          displayName: "Aziza",
          organizationId: "org_1",
          roleTitle: "Администратор"
        },
        db
      )
    ).resolves.toMatchObject({
      item: {
        id: "staff_1"
      }
    });

    expect(staffMemberCreate).not.toHaveBeenCalled();
  });

  it("returns the existing staff member when concurrent creation hits the idempotency key", async () => {
    const duplicateRequestError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`creation_client_request_id`)",
      {
        clientVersion: "test",
        code: "P2002",
        meta: {
          target: ["creation_client_request_id"]
        }
      }
    );
    const db = {
      mediaAsset: {
        findMany: vi.fn(async () => [])
      },
      organization: {
        findUnique: vi.fn(async () => ({
          id: "org_1",
          status: "ACTIVE"
        }))
      },
      staffMember: {
        count: vi.fn(async () => 0),
        create: vi.fn(async () => {
          throw duplicateRequestError;
        }),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: "staff_1"
          }),
        findMany: vi.fn(async () => [
          {
            avatar_media_asset_id: null,
            display_name: "Aziza",
            id: "staff_1",
            is_active: true,
            role_title: "Администратор",
            sort_order: 0
          }
        ])
      }
    } as never;

    await expect(
      createOrganizationStaffMember(
        {
          clientRequestId: "create-staff-request-1",
          displayName: "Aziza",
          organizationId: "org_1",
          roleTitle: "Администратор"
        },
        db
      )
    ).resolves.toMatchObject({
      item: {
        id: "staff_1"
      }
    });
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
