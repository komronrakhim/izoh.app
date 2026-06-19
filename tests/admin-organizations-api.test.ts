import { describe, expect, it, vi } from "vitest";

import { createApiApp } from "~/server/api/app";
import {
  createAdminOrganization,
  enqueueAdminOrganizationDeletion,
  getOrganizationSlugBase
} from "~/server/domain/organizations";
import { MAX_ADMIN_ORGANIZATIONS } from "~/shared/admin";
import { MEDIA_IMAGE_MAX_BYTES, getMediaImageSizeLimit } from "~/shared/media";
import { normalizeTimeZone } from "~/shared/time-zone";

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

describe("admin organizations API", () => {
  it("creates readable slugs from Cyrillic names", () => {
    expect(getOrganizationSlugBase("Кофейня Рахимов")).toBe("kofeynya-rakhimov");
    expect(getOrganizationSlugBase("Чойхона Ғишт")).toBe("choykhona-gisht");
    expect(getOrganizationSlugBase("  😄  ")).toMatch(/^org-/);
  });

  it("uses the same 10 MB image limit for logos, avatars, and submission photos", () => {
    expect(MEDIA_IMAGE_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(getMediaImageSizeLimit("ORGANIZATION_LOGO")).toBe(MEDIA_IMAGE_MAX_BYTES);
    expect(getMediaImageSizeLimit("STAFF_AVATAR")).toBe(MEDIA_IMAGE_MAX_BYTES);
    expect(getMediaImageSizeLimit("SUBMISSION_PHOTO")).toBe(MEDIA_IMAGE_MAX_BYTES);
  });

  it("accepts real IANA time zones and falls back for invalid values", () => {
    expect(normalizeTimeZone("Asia/Samarkand")).toBe("Asia/Samarkand");
    expect(normalizeTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
    expect(normalizeTimeZone("not-a-time-zone")).toBe("UTC");
  });

  it("does not create more than three active organizations per owner", async () => {
    const organizationCreate = vi.fn();
    const db = {
      organization: {
        count: vi.fn(async () => MAX_ADMIN_ORGANIZATIONS),
        create: organizationCreate
      }
    } as never;

    await expect(
      createAdminOrganization(
        {
          locale: "ru",
          name: "Fourth Place",
          ownerUserId: "user_1"
        },
        db
      )
    ).rejects.toThrow("Organization limit reached.");

    expect(organizationCreate).not.toHaveBeenCalled();
  });

  it("returns the existing organization for a repeated creation request", async () => {
    const organizationCreate = vi.fn();
    const db = {
      organization: {
        count: vi.fn(),
        create: organizationCreate,
        findFirst: vi.fn(async () => ({
          contact_text: "",
          description: "",
          id: "org_1",
          locale: "ru",
          name: "Мой дом",
          slug: "moy-dom",
          subscription: null
        }))
      }
    } as never;

    await expect(
      createAdminOrganization(
        {
          clientRequestId: "create-org-request-1",
          locale: "ru",
          name: "Мой дом",
          ownerUserId: "user_1"
        },
        db
      )
    ).resolves.toMatchObject({
      activeOrganizationId: "org_1",
      organization: {
        id: "org_1",
        name: "Мой дом",
        slug: "moy-dom"
      }
    });

    expect(organizationCreate).not.toHaveBeenCalled();
  });

  it("queues organization deletion without deleting synchronously", async () => {
    const tx = {
      organization: {
        update: vi.fn(async () => null)
      },
      organizationDeletionJob: {
        create: vi.fn(async () => ({
          id: "job_1"
        }))
      }
    };
    const db = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
      ),
      organization: {
        findFirst: vi.fn(async () => ({
          id: "org_1",
          name: "Coffee Place",
          slug: "coffee-place"
        }))
      }
    };

    await expect(
      enqueueAdminOrganizationDeletion(
        {
          organizationId: "org_1",
          requestedByUserId: "user_1"
        },
        db as never
      )
    ).resolves.toEqual({
      jobId: "job_1",
      ok: true
    });

    expect(tx.organization.update).toHaveBeenCalledWith({
      data: {
        status: "DELETING"
      },
      where: {
        id: "org_1"
      }
    });
    expect(tx.organizationDeletionJob.create).toHaveBeenCalledWith({
      data: {
        organization_id: "org_1",
        organization_name: "Coffee Place",
        organization_slug: "coffee-place",
        requested_by_user_id: "user_1"
      }
    });
  });

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
        clientRequestId: "create-org-request-1",
        locale: "ru",
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
