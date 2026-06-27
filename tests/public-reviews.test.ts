import { describe, expect, it } from "vitest";

import { createExternalReviewClick, getPublicReviewMetrics } from "~/server/domain/public-reviews";

const publicReviewConfig = {
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
};

const createSubmission = (overrides: Record<string, unknown> = {}) => ({
  guest_entry_scan_id: "scan_1",
  id: "submission_1",
  kind: "REVIEW",
  organization: {
    module_settings: [
      {
        config: {
          publicReview: publicReviewConfig
        }
      }
    ],
    status: "ACTIVE"
  },
  organization_id: "org_1",
  rating: 5,
  ...overrides
});

const createDb = ({
  clicks = [],
  submission = createSubmission()
}: {
  clicks?: Array<{ link_id: string; provider: string }>;
  submission?: unknown;
}) => {
  const created: unknown[] = [];

  return {
    created,
    db: {
      externalReviewClick: {
        create: async (args: unknown) => {
          created.push(args);
          return args;
        },
        findMany: async () => clicks
      },
      submission: {
        findFirst: async () => submission
      }
    } as never
  };
};

describe("public review integrations", () => {
  it("records a click for an eligible review", async () => {
    const { created, db } = createDb({});

    const payload = await createExternalReviewClick(
      {
        guestEntryScanId: "scan_1",
        linkId: "google",
        organizationId: "org_1",
        submissionId: "submission_1"
      },
      db
    );

    expect(payload).toEqual({
      url: "https://google.com/maps/place/example"
    });
    expect(created).toEqual([
      {
        data: {
          guest_entry_scan_id: "scan_1",
          link_id: "google",
          organization_id: "org_1",
          provider: "google",
          rating: 5,
          submission_id: "submission_1",
          target_host: "google.com"
        }
      }
    ]);
  });

  it("rejects low-rating reviews", async () => {
    const { db } = createDb({
      submission: createSubmission({
        rating: 3
      })
    });

    await expect(
      createExternalReviewClick(
        {
          linkId: "google",
          organizationId: "org_1",
          submissionId: "submission_1"
        },
        db
      )
    ).rejects.toThrow("External review link is not available for this rating.");
  });

  it("rejects non-review submissions", async () => {
    const { db } = createDb({
      submission: createSubmission({
        kind: "COMPLAINT",
        rating: null
      })
    });

    await expect(
      createExternalReviewClick(
        {
          linkId: "google",
          organizationId: "org_1",
          submissionId: "submission_1"
        },
        db
      )
    ).rejects.toThrow("External review link is not available.");
  });

  it("rejects disabled links", async () => {
    const { db } = createDb({
      submission: createSubmission({
        organization: {
          module_settings: [
            {
              config: {
                publicReview: {
                  ...publicReviewConfig,
                  links: [
                    {
                      ...publicReviewConfig.links[0],
                      enabled: false
                    }
                  ]
                }
              }
            }
          ],
          status: "ACTIVE"
        }
      })
    });

    await expect(
      createExternalReviewClick(
        {
          linkId: "google",
          organizationId: "org_1",
          submissionId: "submission_1"
        },
        db
      )
    ).rejects.toThrow("External review link is not available.");
  });

  it("rejects unsupported stored links", async () => {
    const { db } = createDb({
      submission: createSubmission({
        organization: {
          module_settings: [
            {
              config: {
                publicReview: {
                  ...publicReviewConfig,
                  links: [
                    {
                      enabled: true,
                      id: "custom",
                      label: "Custom",
                      provider: "custom",
                      sortOrder: 0,
                      url: "https://example.com/reviews"
                    }
                  ]
                }
              }
            }
          ],
          status: "ACTIVE"
        }
      })
    });

    await expect(
      createExternalReviewClick(
        {
          linkId: "custom",
          organizationId: "org_1",
          submissionId: "submission_1"
        },
        db
      )
    ).rejects.toThrow("External review link is not available.");
  });

  it("returns metrics by provider and link", async () => {
    const { db } = createDb({
      clicks: [
        {
          link_id: "google",
          provider: "google"
        },
        {
          link_id: "google",
          provider: "google"
        },
        {
          link_id: "yandex",
          provider: "yandex"
        },
        {
          link_id: "custom",
          provider: "custom"
        }
      ]
    });

    await expect(getPublicReviewMetrics({ organizationId: "org_1" }, db)).resolves.toMatchObject({
      links: [
        {
          count: 2,
          linkId: "google",
          provider: "google"
        },
        {
          count: 1,
          linkId: "yandex",
          provider: "yandex"
        }
      ],
      total: 3
    });
  });
});
