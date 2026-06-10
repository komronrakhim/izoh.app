import { describe, expect, it } from "vitest";

import { getCommentRequired, getContactEnabled } from "~/routes/guest/start-param/module/utils";
import type { GuestEntryChannel } from "~/shared/guest-entry";

const createReviewChannel = (
  settings: Partial<Extract<GuestEntryChannel, { id: "review" }>["settings"]> = {}
): Extract<GuestEntryChannel, { id: "review" }> => ({
  id: "review",
  module: "REVIEW",
  settings: {
    commentRequired: false,
    contactEnabled: true,
    lowRatingCommentEnabled: true,
    lowRatingThreshold: 3,
    photosEnabled: true,
    ...settings
  }
});

describe("guest wizard utils", () => {
  it("requires review text only when the review settings ask for low-rating details", () => {
    expect(getCommentRequired({ channel: createReviewChannel(), rating: 2 })).toBe(true);
    expect(
      getCommentRequired({
        channel: createReviewChannel({ lowRatingCommentEnabled: false }),
        rating: 2
      })
    ).toBe(false);
  });

  it("shows optional contact for low reviews only when low-rating details are enabled", () => {
    expect(getContactEnabled({ channel: createReviewChannel(), rating: 2 })).toBe(true);
    expect(
      getContactEnabled({
        channel: createReviewChannel({ lowRatingCommentEnabled: false }),
        rating: 2
      })
    ).toBe(false);
    expect(
      getContactEnabled({
        channel: createReviewChannel({ contactEnabled: false }),
        rating: 2
      })
    ).toBe(false);
  });
});
