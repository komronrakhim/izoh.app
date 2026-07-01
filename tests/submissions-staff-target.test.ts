import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "../prisma/generated/prisma/client";

import { enqueueSubmissionNotifications } from "~/server/domain/notification-deliveries";
import { createSubmission, toAdminSubmissionItem } from "~/server/domain/submissions";
import type { SubmissionMetadata } from "~/shared/submissions";

vi.mock("~/server/domain/notification-deliveries", () => ({
  enqueueSubmissionNotifications: vi.fn(async () => 0)
}));

const enqueueSubmissionNotificationsMock = vi.mocked(enqueueSubmissionNotifications);

const createMockDb = ({
  activeStaffCount = 0,
  moduleSettings,
  staffMemberFound = true,
  staffSettings = {
    allowTeamReview: true,
    guestSelectionEnabled: true
  }
}: {
  activeStaffCount?: number;
  moduleSettings?: Array<{
    config: unknown;
    enabled: boolean;
    module: string;
  }>;
  staffMemberFound?: boolean;
  staffSettings?: {
    allowTeamReview: boolean;
    guestSelectionEnabled: boolean;
  };
}) => {
  const effectiveModuleSettings = moduleSettings ?? [
    {
      config: {},
      enabled: true,
      module: "REVIEW"
    },
    {
      config: staffSettings,
      enabled: true,
      module: "STAFF"
    }
  ];

  return {
    organization: {
      findUnique: vi.fn(async () => ({
        id: "org_1",
        module_settings: effectiveModuleSettings,
        status: "ACTIVE"
      }))
    },
    staffMember: {
      count: vi.fn(async () => activeStaffCount),
      findFirst: vi.fn(async () => (staffMemberFound ? { id: "staff_1" } : null))
    },
    mediaAsset: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({
        count: 0
      }))
    },
    submission: {
      create: vi.fn(async ({ data }) => ({
        id: "submission_1",
        ...data
      })),
      findFirst: vi.fn(async () => null)
    },
    telegramNotificationDelivery: {
      create: vi.fn(async ({ data }) => ({
        id: "delivery_1",
        ...data
      }))
    }
  } as never;
};

describe("submission staff targeting", () => {
  beforeEach(() => {
    enqueueSubmissionNotificationsMock.mockReset();
    enqueueSubmissionNotificationsMock.mockResolvedValue(0);
  });

  it("rejects unavailable staff members", async () => {
    await expect(
      createSubmission(
        {
          kind: "REVIEW",
          organizationId: "org_1",
          rating: 5,
          targetStaffMemberId: "other_staff"
        },
        createMockDb({
          staffMemberFound: false
        })
      )
    ).rejects.toThrow("Staff member is not available");
  });

  it("rejects staff targeting for suggestions", async () => {
    await expect(
      createSubmission(
        {
          bodyText: "Add more desserts",
          kind: "SUGGESTION",
          organizationId: "org_1",
          targetStaffMemberId: "staff_1"
        },
        createMockDb({})
      )
    ).rejects.toThrow("only for reviews and complaints");
  });

  it("requires a staff member when team reviews are disabled and active staff exists", async () => {
    await expect(
      createSubmission(
        {
          kind: "REVIEW",
          organizationId: "org_1",
          rating: 4
        },
        createMockDb({
          activeStaffCount: 1,
          staffSettings: {
            allowTeamReview: false,
            guestSelectionEnabled: true
          }
        })
      )
    ).rejects.toThrow("Staff member is required");
  });

  it("accepts an unknown staff target when guests should not be forced to choose a person", async () => {
    await expect(
      createSubmission(
        {
          kind: "REVIEW",
          metadata: {
            staffTargetType: "unknown",
            wizardChoiceId: "ok"
          },
          organizationId: "org_1",
          rating: 4
        },
        createMockDb({
          activeStaffCount: 1,
          staffSettings: {
            allowTeamReview: false,
            guestSelectionEnabled: true
          }
        })
      )
    ).resolves.toMatchObject({
      id: "submission_1"
    });
  });

  it("persists wizard metadata with the submission", async () => {
    const db = createMockDb({}) as {
      submission: {
        create: ReturnType<typeof vi.fn>;
      };
    };
    const metadata: SubmissionMetadata = {
      complaintCategoryIds: ["service", "wait"],
      staffTargetType: "team",
      wizardChoiceId: "issue"
    };

    await createSubmission(
      {
        bodyText: "Too slow",
        kind: "COMPLAINT",
        metadata,
        organizationId: "org_1"
      },
      db as never
    );

    expect(db.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata
        })
      })
    );
  });

  it("returns the existing submission for a repeated client request", async () => {
    const db = createMockDb({}) as {
      mediaAsset: {
        updateMany: ReturnType<typeof vi.fn>;
      };
      submission: {
        create: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
      };
    };

    db.submission.findFirst.mockResolvedValueOnce({
      id: "submission_existing",
      kind: "REVIEW",
      organization_id: "org_1",
      rating: 5
    });

    await expect(
      createSubmission(
        {
          clientRequestId: "submission-request-1",
          kind: "REVIEW",
          organizationId: "org_1",
          rating: 5
        },
        db as never
      )
    ).resolves.toMatchObject({
      id: "submission_existing"
    });

    expect(db.submission.create).not.toHaveBeenCalled();
    expect(db.mediaAsset.updateMany).not.toHaveBeenCalled();
    expect(enqueueSubmissionNotificationsMock).toHaveBeenCalledWith(
      {
        kind: "REVIEW",
        organizationId: "org_1",
        rating: 5,
        submissionId: "submission_existing"
      },
      db
    );
  });

  it("returns the existing submission when the client request races", async () => {
    const db = createMockDb({}) as {
      submission: {
        create: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
    const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      clientVersion: "test",
      code: "P2002",
      meta: {
        target: ["client_request_id"]
      }
    });

    db.submission.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "submission_existing",
        kind: "REVIEW",
        organization_id: "org_1",
        rating: 5
      });
    db.submission.create.mockRejectedValueOnce(uniqueError);

    await expect(
      createSubmission(
        {
          clientRequestId: "submission-request-1",
          kind: "REVIEW",
          organizationId: "org_1",
          rating: 5
        },
        db as never
      )
    ).resolves.toMatchObject({
      id: "submission_existing"
    });

    expect(enqueueSubmissionNotificationsMock).toHaveBeenCalledWith(
      {
        kind: "REVIEW",
        organizationId: "org_1",
        rating: 5,
        submissionId: "submission_existing"
      },
      db
    );
  });

  it("stores a staff snapshot with submissions that target an employee", async () => {
    const db = createMockDb({}) as {
      staffMember: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      submission: {
        create: ReturnType<typeof vi.fn>;
      };
    };

    db.staffMember.findFirst.mockResolvedValueOnce({
      avatar_media_asset_id: null,
      display_name: "Aziza",
      id: "staff_1",
      role_title: "Бариста"
    });

    await createSubmission(
      {
        kind: "REVIEW",
        metadata: {
          staffTargetType: "employee"
        },
        organizationId: "org_1",
        rating: 5,
        targetStaffMemberId: "staff_1"
      },
      db as never
    );

    expect(db.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            staffTargetSnapshot: {
              avatarUrl: null,
              displayName: "Aziza",
              id: "staff_1",
              roleTitle: "Бариста"
            },
            staffTargetType: "employee"
          })
        })
      })
    );
  });

  it("shows the stored staff snapshot even if the staff row was renamed later", () => {
    const item = toAdminSubmissionItem({
      attachments: [],
      body_text: "Муомала йок",
      created_at: new Date("2026-06-17T12:34:21.962Z"),
      customer_allows_reply: false,
      customer_contact_phone: null,
      customer_display_name: null,
      id: "submission_1",
      kind: "COMPLAINT",
      locale: "ru",
      metadata: {
        complaintCategoryIds: ["service"],
        staffTargetSnapshot: {
          displayName: "Сардор",
          id: "staff_1",
          roleTitle: "Официант"
        },
        staffTargetType: "employee"
      },
      qr_context: "Стол 5",
      rating: null,
      target_staff_member: {
        display_name: "Хадича",
        id: "staff_1",
        role_title: "Бариста"
      }
    });

    expect(item.targetStaffMember).toEqual({
      displayName: "Сардор",
      id: "staff_1",
      roleTitle: "Официант"
    });
  });

  it("requires text for low rating reviews when the organization asks for it", async () => {
    await expect(
      createSubmission(
        {
          kind: "REVIEW",
          organizationId: "org_1",
          rating: 2
        },
        createMockDb({})
      )
    ).rejects.toThrow("text is required");
  });

  it("requires text for suggestions", async () => {
    await expect(
      createSubmission(
        {
          kind: "SUGGESTION",
          metadata: {
            suggestionTopicIds: ["service"],
            wizardChoiceId: "idea"
          },
          organizationId: "org_1"
        },
        createMockDb({})
      )
    ).rejects.toThrow("text is required");
  });

  it("requires contact when complaint reply settings make it required", async () => {
    await expect(
      createSubmission(
        {
          bodyText: "Please call me",
          kind: "COMPLAINT",
          metadata: {
            complaintCategoryIds: ["service"],
            wizardChoiceId: "issue"
          },
          organizationId: "org_1"
        },
        createMockDb({
          moduleSettings: [
            {
              config: {
                categoriesEnabled: true,
                commentRequired: false,
                complaintCategoryIds: ["service"],
                contactEnabled: true,
                contactRequired: true,
                photosEnabled: true
              },
              enabled: true,
              module: "COMPLAINT"
            }
          ]
        })
      )
    ).rejects.toThrow("Contact is required");
  });

  it("requires at least one detail for complaints when text is optional", async () => {
    await expect(
      createSubmission(
        {
          kind: "COMPLAINT",
          metadata: {
            wizardChoiceId: "issue"
          },
          organizationId: "org_1"
        },
        createMockDb({
          moduleSettings: [
            {
              config: {
                categoriesEnabled: true,
                commentRequired: false,
                complaintCategoryIds: ["service"],
                contactEnabled: false,
                contactRequired: false,
                photosEnabled: true
              },
              enabled: true,
              module: "COMPLAINT"
            }
          ]
        })
      )
    ).rejects.toThrow("at least one detail");
  });

  it("rejects complaint topics outside organization settings", async () => {
    await expect(
      createSubmission(
        {
          bodyText: "Bad wait time",
          kind: "COMPLAINT",
          metadata: {
            complaintCategoryIds: ["wait"],
            wizardChoiceId: "issue"
          },
          organizationId: "org_1"
        },
        createMockDb({
          moduleSettings: [
            {
              config: {
                categoriesEnabled: true,
                commentRequired: false,
                complaintCategoryIds: ["service"],
                contactEnabled: false,
                contactRequired: false,
                photosEnabled: true
              },
              enabled: true,
              module: "COMPLAINT"
            }
          ]
        })
      )
    ).rejects.toThrow("Complaint topic is not available");
  });

  it("surfaces notification enqueue failures so important alerts are not silently lost", async () => {
    enqueueSubmissionNotificationsMock.mockRejectedValueOnce(new Error("Database lock timeout"));

    await expect(
      createSubmission(
        {
          bodyText: "Nice",
          kind: "REVIEW",
          organizationId: "org_1",
          rating: 5
        },
        createMockDb({})
      )
    ).rejects.toThrow("Database lock timeout");
  });

  it("re-enqueues notifications when an idempotent submission already exists", async () => {
    const duplicateRequestError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`client_request_id`)",
      {
        clientVersion: "test",
        code: "P2002",
        meta: {
          target: ["client_request_id"]
        }
      }
    );
    const existingSubmission = {
      body_text: "Nice",
      client_request_id: "submission-request-1",
      customer_allows_reply: false,
      customer_contact_phone: null,
      customer_display_name: null,
      customer_user_id: "user_1",
      guest_entry_scan_id: null,
      id: "submission_existing",
      kind: "REVIEW" as const,
      locale: "ru",
      metadata: {},
      organization_id: "org_1",
      qr_context: null,
      rating: 5,
      target_staff_member_id: null
    };
    const db = createMockDb({}) as never as {
      organization: unknown;
      staffMember: unknown;
      submission: {
        create: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
      };
      mediaAsset: unknown;
      telegramNotificationDelivery: unknown;
    };

    db.submission.create.mockRejectedValueOnce(duplicateRequestError);
    db.submission.findFirst.mockResolvedValueOnce(existingSubmission);

    await expect(
      createSubmission(
        {
          bodyText: "Nice",
          clientRequestId: "submission-request-1",
          customerUserId: "user_1",
          kind: "REVIEW",
          organizationId: "org_1",
          rating: 5
        },
        db as never
      )
    ).resolves.toEqual(existingSubmission);

    expect(enqueueSubmissionNotificationsMock).toHaveBeenCalledWith(
      {
        kind: "REVIEW",
        organizationId: "org_1",
        rating: 5,
        submissionId: "submission_existing"
      },
      db
    );
  });

  it("attaches ready photos and reassigns media assets to the created submission", async () => {
    const db = createMockDb({}) as {
      mediaAsset: {
        findMany: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
      };
      submission: {
        create: ReturnType<typeof vi.fn>;
      };
    };

    db.mediaAsset.findMany.mockResolvedValueOnce([
      {
        id: "photo_1"
      }
    ]);

    await createSubmission(
      {
        attachmentMediaAssetIds: ["photo_1"],
        attachmentOwnerId: "draft_upload_1",
        bodyText: "Nice",
        kind: "REVIEW",
        organizationId: "org_1",
        rating: 5
      },
      db as never
    );

    expect(db.mediaAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: ["photo_1"]
          },
          kind: "SUBMISSION_PHOTO",
          owner_id: "draft_upload_1",
          status: "READY"
        })
      })
    );
    expect(db.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attachments: {
            create: [
              {
                media_asset_id: "photo_1",
                sort_order: 0
              }
            ]
          }
        })
      })
    );
    expect(db.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          owner_id: "submission_1",
          owner_type: "SUBMISSION"
        },
        where: {
          id: {
            in: ["photo_1"]
          }
        }
      })
    );
  });
});
