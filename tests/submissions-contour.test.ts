import { describe, expect, it, vi } from "vitest";

import {
  createSubmission,
  getOrganizationSubmissions,
  getSubmissionAdminItem
} from "~/server/domain/submissions";

vi.mock("~/server/domain/notification-deliveries", () => ({
  enqueueSubmissionNotifications: vi.fn(async () => 0)
}));

const createContourDb = () => {
  const submissions: Array<{
    attachments: [];
    body_text: string;
    created_at: Date;
    customer_allows_reply: boolean;
    customer_contact_phone: null | string;
    customer_display_name: null | string;
    guest_entry_scan_id: null | string;
    id: string;
    kind: "COMPLAINT" | "REVIEW" | "SUGGESTION";
    locale: "ru" | "uz";
    metadata: unknown;
    organization_id: string;
    qr_context: null | string;
    rating: null | number;
    target_staff_member: null;
  }> = [];

  return {
    mediaAsset: {
      findMany: vi.fn(async () => [])
    },
    organization: {
      findUnique: vi.fn(async () => ({
        id: "org_1",
        module_settings: [],
        status: "ACTIVE"
      }))
    },
    staffMember: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null)
    },
    submission: {
      count: vi.fn(
        async ({ where } = {}) =>
          submissions.filter((item) => {
            if (where?.organization_id && item.organization_id !== where.organization_id) {
              return false;
            }

            if (where?.kind && item.kind !== where.kind) {
              return false;
            }

            return true;
          }).length
      ),
      create: vi.fn(async ({ data }) => {
        const record = {
          attachments: [],
          body_text: data.body_text,
          created_at: new Date("2026-06-06T14:20:00.000Z"),
          customer_allows_reply: data.customer_allows_reply,
          customer_contact_phone: data.customer_contact_phone ?? null,
          customer_display_name: data.customer_display_name ?? null,
          guest_entry_scan_id: data.guest_entry_scan_id ?? null,
          id: "submission_1",
          kind: data.kind,
          locale: data.locale,
          metadata: data.metadata,
          organization_id: data.organization_id,
          qr_context: data.qr_context ?? null,
          rating: data.rating ?? null,
          target_staff_member: null
        } as (typeof submissions)[number];

        submissions.unshift(record);

        return {
          id: record.id,
          ...data
        };
      }),
      findMany: vi.fn(async ({ take, where } = {}) =>
        submissions
          .filter((item) => {
            if (where?.organization_id && item.organization_id !== where.organization_id) {
              return false;
            }

            if (where?.kind && item.kind !== where.kind) {
              return false;
            }

            return true;
          })
          .slice(0, take ?? submissions.length)
      ),
      findUnique: vi.fn(
        async ({ where }) => submissions.find((item) => item.id === where.id) ?? null
      )
    },
    telegramNotificationDelivery: {
      create: vi.fn(async ({ data }) => ({
        id: "delivery_1",
        ...data
      }))
    }
  } as never;
};

describe("submission product contour", () => {
  it("creates a guest submission and exposes it to the admin feed", async () => {
    const db = createContourDb();

    const created = await createSubmission(
      {
        bodyText: "Все понравилось",
        kind: "REVIEW",
        metadata: {
          wizardChoiceId: "great"
        },
        organizationId: "org_1",
        qrContext: "Стол 4",
        guestEntryScanId: "scan_1",
        rating: 5
      },
      db
    );
    const feed = await getOrganizationSubmissions({ organizationId: "org_1" }, db);
    const createdItem = await getSubmissionAdminItem(created.id, db);

    expect(feed).toMatchObject({
      counts: {
        ALL: 1,
        COMPLAINT: 0,
        REVIEW: 1,
        SUGGESTION: 0
      },
      nextCursor: null,
      organizationId: "org_1",
      total: 1
    });
    expect(created.guest_entry_scan_id).toBe("scan_1");
    expect(feed.items[0]).toMatchObject({
      bodyText: "Все понравилось",
      kind: "REVIEW",
      metadata: {
        wizardChoiceId: "great"
      },
      qrContext: "Стол 4",
      rating: 5
    });
    expect(createdItem).toMatchObject(feed.items[0]);
  });
});
