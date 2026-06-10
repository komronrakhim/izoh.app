import { describe, expect, it } from "vitest";

import { createApiApp } from "~/server/api/app";
import { mergeModuleSettings, parseModuleSettingsConfig } from "~/shared/module-settings";

const restoreDatabaseUrl = (databaseUrl: string | undefined) => {
  if (databaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = databaseUrl;
};

describe("module settings API", () => {
  it("requires a database for module settings", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const response = await createApiApp().request(
      "/api/organizations/org_1/modules/review/settings"
    );
    const payload = (await response.json()) as { error: string };

    restoreDatabaseUrl(databaseUrl);

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("requires a database to patch module settings", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const response = await createApiApp().request(
      "/api/organizations/org_1/modules/review/settings",
      {
        body: JSON.stringify({
          commentRequired: true,
          lowRatingThreshold: 4
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      }
    );
    const payload = (await response.json()) as { error: string };

    restoreDatabaseUrl(databaseUrl);

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("validates review settings threshold", () => {
    expect(() =>
      mergeModuleSettings({
        itemId: "review",
        patch: {
          lowRatingThreshold: 6
        }
      })
    ).toThrow();
  });

  it("keeps existing review settings when patching one field", () => {
    const settings = mergeModuleSettings({
      current: {
        commentRequired: true,
        contactEnabled: false,
        lowRatingCommentEnabled: false,
        lowRatingThreshold: 4,
        photosEnabled: false
      },
      itemId: "review",
      patch: {
        lowRatingThreshold: 2
      }
    });

    expect(settings).toEqual({
      commentRequired: true,
      contactEnabled: false,
      lowRatingCommentEnabled: false,
      lowRatingThreshold: 2,
      photosEnabled: false
    });
  });

  it("keeps review low rating threshold when disabling low rating comments", () => {
    const settings = mergeModuleSettings({
      current: {
        commentRequired: false,
        contactEnabled: true,
        lowRatingCommentEnabled: true,
        lowRatingThreshold: 4,
        photosEnabled: true
      },
      itemId: "review",
      patch: {
        lowRatingCommentEnabled: false
      }
    });

    expect(settings).toEqual({
      commentRequired: false,
      contactEnabled: true,
      lowRatingCommentEnabled: false,
      lowRatingThreshold: 4,
      photosEnabled: true
    });
  });

  it("returns default complaint category settings", () => {
    const settings = mergeModuleSettings({
      itemId: "complaint",
      patch: {}
    });

    expect(settings).toMatchObject({
      categoriesEnabled: true,
      commentRequired: true,
      complaintCategoryIds: [
        "service",
        "quality",
        "cleanliness",
        "wait",
        "payment",
        "conditions",
        "other"
      ]
    });
  });

  it("validates complaint category settings", () => {
    expect(() =>
      mergeModuleSettings({
        itemId: "complaint",
        patch: {
          complaintCategoryIds: []
        }
      })
    ).toThrow();

    expect(() =>
      mergeModuleSettings({
        itemId: "complaint",
        patch: {
          complaintCategoryIds: ["service", "unknown"]
        }
      })
    ).toThrow();
  });

  it("keeps existing complaint settings when patching one field", () => {
    const settings = mergeModuleSettings({
      current: {
        categoriesEnabled: true,
        commentRequired: false,
        complaintCategoryIds: ["service", "quality"],
        contactEnabled: true,
        contactRequired: true,
        photosEnabled: true
      },
      itemId: "complaint",
      patch: {
        photosEnabled: false
      }
    });

    expect(settings).toEqual({
      categoriesEnabled: true,
      commentRequired: false,
      complaintCategoryIds: ["service", "quality"],
      contactEnabled: true,
      contactRequired: true,
      photosEnabled: false
    });
  });

  it("sanitizes stale complaint categories from stored settings", () => {
    const settings = parseModuleSettingsConfig({
      config: {
        categoriesEnabled: true,
        commentRequired: false,
        complaintCategoryIds: ["service", "place", "quality"],
        contactEnabled: true,
        contactRequired: false,
        photosEnabled: true
      },
      itemId: "complaint"
    });

    expect(settings.complaintCategoryIds).toEqual(["service", "quality"]);
  });

  it("returns default suggestion topic settings", () => {
    const settings = mergeModuleSettings({
      itemId: "suggestion",
      patch: {}
    });

    expect(settings).toMatchObject({
      categoriesEnabled: true,
      contactEnabled: false,
      contactRequired: false,
      photosEnabled: true,
      suggestionTopicIds: ["service", "product", "comfort", "price", "speed", "events", "other"]
    });
  });

  it("validates suggestion topic settings", () => {
    expect(() =>
      mergeModuleSettings({
        itemId: "suggestion",
        patch: {
          suggestionTopicIds: []
        }
      })
    ).toThrow();

    expect(() =>
      mergeModuleSettings({
        itemId: "suggestion",
        patch: {
          suggestionTopicIds: ["service", "unknown"]
        }
      })
    ).toThrow();
  });

  it("keeps existing suggestion settings when patching one field", () => {
    const settings = mergeModuleSettings({
      current: {
        categoriesEnabled: true,
        contactEnabled: true,
        contactRequired: true,
        photosEnabled: true,
        suggestionTopicIds: ["service", "product"]
      },
      itemId: "suggestion",
      patch: {
        photosEnabled: false
      }
    });

    expect(settings).toEqual({
      categoriesEnabled: true,
      contactEnabled: true,
      contactRequired: true,
      photosEnabled: false,
      suggestionTopicIds: ["service", "product"]
    });
  });

  it("keeps staff settings as a target layer without channel photo settings", () => {
    const settings = mergeModuleSettings({
      itemId: "staff",
      patch: {
        guestSelectionEnabled: false
      }
    });

    expect(settings).toEqual({
      allowTeamReview: true,
      guestSelectionEnabled: false
    });
    expect(settings).not.toHaveProperty("photosEnabled");
  });
});
