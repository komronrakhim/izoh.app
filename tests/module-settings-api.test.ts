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

    expect(settings).toMatchObject({
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

    expect(settings).toMatchObject({
      commentRequired: false,
      contactEnabled: true,
      lowRatingCommentEnabled: false,
      lowRatingThreshold: 4,
      photosEnabled: true
    });
  });

  it("returns default public review settings", () => {
    const settings = parseModuleSettingsConfig({
      config: {},
      itemId: "review"
    });

    expect(settings.publicReview).toEqual({
      enabled: false,
      links: [],
      minRating: 4
    });
  });

  it("deep-merges public review settings when patching one nested field", () => {
    const settings = mergeModuleSettings({
      current: {
        publicReview: {
          enabled: true,
          links: [
            {
              enabled: true,
              id: "google",
              label: "Google",
              provider: "google",
              sortOrder: 0,
              url: "https://google.com/maps/place/example"
            }
          ],
          minRating: 4
        }
      },
      itemId: "review",
      patch: {
        publicReview: {
          minRating: 3
        }
      }
    });

    expect(settings.publicReview).toEqual({
      enabled: true,
      links: [
        {
          enabled: true,
          id: "google",
          label: "Google",
          provider: "google",
          sortOrder: 0,
          url: "https://google.com/maps/place/example"
        }
      ],
      minRating: 3
    });
  });

  it("requires public review minimum rating to be 4 or lower", () => {
    expect(() =>
      mergeModuleSettings({
        itemId: "review",
        patch: {
          publicReview: {
            minRating: 5
          }
        }
      })
    ).toThrow();
  });

  it("validates public review links", () => {
    expect(() =>
      mergeModuleSettings({
        itemId: "review",
        patch: {
          publicReview: {
            links: [
              {
                enabled: true,
                id: "google",
                label: "Google",
                provider: "google",
                sortOrder: 0,
                url: "not-a-url"
              }
            ]
          }
        }
      })
    ).toThrow();

    expect(() =>
      mergeModuleSettings({
        itemId: "review",
        patch: {
          publicReview: {
            links: [
              {
                enabled: true,
                id: "google",
                label: "Google",
                provider: "google",
                sortOrder: 0,
                url: "https://google.evil.example/maps/place/fake"
              }
            ]
          }
        }
      })
    ).toThrow();

    expect(() =>
      mergeModuleSettings({
        itemId: "review",
        patch: {
          publicReview: {
            links: [
              {
                enabled: true,
                id: "custom",
                label: "Custom reviews",
                provider: "custom",
                sortOrder: 0,
                url: "https://example.com/reviews"
              }
            ]
          }
        }
      })
    ).toThrow();

    expect(() =>
      mergeModuleSettings({
        itemId: "review",
        patch: {
          publicReview: {
            links: [
              {
                enabled: true,
                id: "custom",
                label: "",
                provider: "custom",
                sortOrder: 0,
                url: "https://example.com/reviews"
              }
            ]
          }
        }
      })
    ).toThrow();

    expect(() =>
      mergeModuleSettings({
        itemId: "review",
        patch: {
          publicReview: {
            links: [
              {
                enabled: true,
                id: "google",
                label: "Google",
                provider: "google",
                sortOrder: 0,
                url: "https://example.com/reviews"
              }
            ]
          }
        }
      })
    ).toThrow();

    expect(() =>
      mergeModuleSettings({
        itemId: "review",
        patch: {
          publicReview: {
            links: [
              {
                enabled: true,
                id: "google",
                label: "Google",
                provider: "google",
                sortOrder: 0,
                url: "https://google.com/maps/place/example"
              },
              {
                enabled: true,
                id: "google",
                label: "Google duplicate",
                provider: "google",
                sortOrder: 1,
                url: "https://maps.google.com/?cid=123"
              }
            ]
          }
        }
      })
    ).toThrow();
  });

  it("drops unsupported stored public review links", () => {
    const settings = parseModuleSettingsConfig({
      config: {
        publicReview: {
          enabled: true,
          links: [
            {
              enabled: true,
              id: "legacy-custom",
              label: "Legacy custom",
              provider: "custom",
              sortOrder: 0,
              url: "https://example.com/reviews"
            },
            {
              enabled: true,
              id: "manual-google",
              label: "Manual Google",
              provider: "google",
              sortOrder: 1,
              url: "https://example.com/reviews"
            },
            {
              enabled: true,
              id: "manual-yandex",
              label: "Yandex",
              provider: "yandex",
              sortOrder: 2,
              url: "https://yandex.uz/maps/org/example"
            }
          ],
          minRating: 4
        }
      },
      itemId: "review"
    });

    expect(settings.publicReview.links).toEqual([
      {
        enabled: true,
        id: "yandex",
        label: "Yandex",
        provider: "yandex",
        sortOrder: 2,
        url: "https://yandex.uz/maps/org/example"
      }
    ]);
  });

  it("clamps stored public review minimum rating to 4 or lower", () => {
    const settings = parseModuleSettingsConfig({
      config: {
        publicReview: {
          enabled: true,
          minRating: 5
        }
      },
      itemId: "review"
    });

    expect(settings.publicReview.minRating).toBe(4);
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
