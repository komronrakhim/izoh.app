import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApiApp } from "~/server/api/app";
import { getGuestEntryConfig } from "~/server/domain/guest-entry-config";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("guest entry config API", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("requires a database for guest entry config", async () => {
    const response = await createApiApp().request("/api/guest-entry/coffee-place");
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("returns guest channels without treating staff as a submission channel", async () => {
    const payload = await getGuestEntryConfig(
      {
        startParam: "coffee-place"
      },
      {
        mediaAsset: {
          findFirst: async () => null,
          findMany: async () => []
        },
        organization: {
          findFirst: async () => ({
            description: "",
            id: "org_1",
            locale: "ru",
            logo_media_asset_id: null,
            module_settings: [],
            name: "Coffee Place",
            staff_members: [],
            status: "ACTIVE"
          })
        }
      } as never
    );

    expect(payload.channels.map((channel) => channel.id)).toEqual([
      "review",
      "complaint",
      "suggestion"
    ]);
    expect(payload.channels).not.toContainEqual(
      expect.objectContaining({
        id: "staff"
      })
    );
    expect(payload.menu).toEqual({ available: false });
    expect(payload.staff.enabled).toBe(false);
  });

  it("resolves a short context code into its stored label", async () => {
    const payload = await getGuestEntryConfig(
      {
        startParam: "coffee-place__a7k2q"
      },
      {
        mediaAsset: {
          findFirst: async () => null,
          findMany: async () => []
        },
        organization: {
          findFirst: async () => ({
            description: "",
            id: "org_1",
            locale: "ru",
            logo_media_asset_id: null,
            module_settings: [],
            name: "Coffee Place",
            staff_members: [],
            status: "ACTIVE"
          })
        },
        organizationGuestContext: {
          findFirst: async () => ({
            code: "a7k2q",
            id: "context_1",
            label: "Стол 4"
          })
        }
      } as never
    );

    expect(payload.qrContext).toBe("Стол 4");
  });
});
