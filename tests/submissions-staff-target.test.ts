import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSubmission } from "~/server/domain/submissions";
import { notifySubmissionRecipients } from "~/server/telegram";
import type { SubmissionMetadata } from "~/shared/submissions";

vi.mock("~/server/telegram", () => ({
  notifySubmissionRecipients: vi.fn(async () => undefined)
}));

const notifySubmissionRecipientsMock = vi.mocked(notifySubmissionRecipients);

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
      }))
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
    notifySubmissionRecipientsMock.mockResolvedValue(undefined);
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

  it("does not fail submission creation when Telegram notification delivery fails", async () => {
    notifySubmissionRecipientsMock.mockRejectedValueOnce(new Error("Bot token missing"));

    const db = createMockDb({}) as {
      telegramNotificationDelivery: {
        create: ReturnType<typeof vi.fn>;
      };
    };

    await expect(
      createSubmission(
        {
          bodyText: "Nice",
          kind: "REVIEW",
          organizationId: "org_1",
          rating: 5
        },
        db as never
      )
    ).resolves.toMatchObject({
      id: "submission_1"
    });

    expect(db.telegramNotificationDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error: "Bot token missing",
          status: "FAILED",
          submission_id: "submission_1"
        })
      })
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
        id: "photo_1",
        upload_session_id: "session_1"
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
          OR: [
            {
              id: {
                in: ["photo_1"]
              }
            },
            {
              upload_session_id: {
                in: ["session_1"]
              }
            }
          ]
        }
      })
    );
  });
});
