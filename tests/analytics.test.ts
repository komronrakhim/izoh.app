import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiApp } from "~/server/api/app";
import { getOrganizationAnalytics } from "~/server/domain/analytics";

const originalDatabaseUrl = process.env.DATABASE_URL;

const createAnalyticsDb = ({ staffEnabled = true }: { staffEnabled?: boolean } = {}) =>
  ({
    organization: {
      findUnique: vi.fn(async () => ({
        id: "org_1",
        module_settings: staffEnabled
          ? [
              {
                enabled: true,
                module: "STAFF"
              }
            ]
          : [],
        status: "ACTIVE",
        time_zone: "Europe/Berlin"
      }))
    },
    submission: {
      findMany: vi.fn(async () => [
        {
          attachments: [
            {
              id: "attachment_1"
            }
          ],
          body_text: "Aziza очень помогла",
          created_at: new Date("2026-06-10T10:00:00.000Z"),
          customer_contact_phone: "@guest",
          kind: "REVIEW",
          metadata: {
            staffTargetSnapshot: {
              displayName: "Aziza",
              id: "staff_1",
              roleTitle: "Бариста"
            },
            staffTargetType: "employee"
          },
          qr_context: "Стол 4",
          rating: 5,
          target_staff_member: {
            display_name: "Хадича",
            id: "staff_1",
            role_title: "Бариста"
          }
        },
        {
          attachments: [],
          body_text: "Долго ждали",
          created_at: new Date("2026-06-09T18:00:00.000Z"),
          customer_contact_phone: null,
          kind: "COMPLAINT",
          metadata: {
            complaintCategoryIds: ["wait"],
            staffTargetType: "team"
          },
          qr_context: "Бар",
          rating: null,
          target_staff_member: null
        },
        {
          attachments: [],
          body_text: "Добавьте безлактозное молоко",
          created_at: new Date("2026-06-08T09:00:00.000Z"),
          customer_contact_phone: null,
          kind: "SUGGESTION",
          metadata: {
            suggestionTopicIds: ["product"]
          },
          qr_context: "Бар",
          rating: null,
          target_staff_member: null
        },
        {
          attachments: [],
          body_text: "Было не очень",
          created_at: new Date("2026-06-01T12:00:00.000Z"),
          customer_contact_phone: null,
          kind: "REVIEW",
          metadata: {},
          qr_context: null,
          rating: 2,
          target_staff_member: null
        }
      ])
    }
  }) as never;

describe("organization analytics", () => {
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

  it("requires a database for analytics API", async () => {
    const response = await createApiApp().request("/api/organizations/org_1/analytics");
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Database is required.");
  });

  it("builds period analytics with mood, topics, contexts, and team gratitude", async () => {
    const analytics = await getOrganizationAnalytics(
      {
        now: new Date("2026-06-11T12:00:00.000Z"),
        organizationId: "org_1",
        period: "7D"
      },
      createAnalyticsDb()
    );

    expect(analytics.totals.counts).toMatchObject({
      ALL: 3,
      COMPLAINT: 1,
      REVIEW: 1,
      SUGGESTION: 1
    });
    expect(analytics.totals.trend).toMatchObject({
      current: 3,
      direction: "up",
      previous: 1
    });
    expect(analytics.rating).toMatchObject({
      average: 5,
      previousAverage: 2,
      positiveCount: 1
    });
    expect(analytics.topics.complaint[0]).toMatchObject({
      count: 1,
      id: "wait"
    });
    expect(analytics.topics.suggestion[0]).toMatchObject({
      count: 1,
      id: "product"
    });
    expect(analytics.contexts[0]).toMatchObject({
      count: 2,
      label: "Бар"
    });
    expect(analytics.staff.enabled).toBe(true);
    expect(analytics.staff.items[0]).toMatchObject({
      displayName: "Aziza",
      mentionsCount: 1,
      thanksCount: 1
    });
    expect(analytics.staff.team).toMatchObject({
      complaintCount: 1,
      mentionsCount: 1
    });
    expect(analytics.engagement).toMatchObject({
      withContact: 1,
      withPhotos: 1,
      withText: 3
    });
    expect(analytics.range.timeZone).toBe("Europe/Berlin");
    expect(analytics.time.peakHour).toMatchObject({
      count: 1,
      hour: 11
    });
  });

  it("does not expose team analytics when staff module is disabled", async () => {
    const analytics = await getOrganizationAnalytics(
      {
        now: new Date("2026-06-11T12:00:00.000Z"),
        organizationId: "org_1",
        period: "7D"
      },
      createAnalyticsDb({
        staffEnabled: false
      })
    );

    expect(analytics.staff.enabled).toBe(false);
    expect(analytics.staff.items).toHaveLength(0);
    expect(analytics.staff.team.mentionsCount).toBe(0);
  });
});
