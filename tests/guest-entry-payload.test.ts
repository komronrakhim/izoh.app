import { describe, expect, it } from "vitest";

import {
  createGuestEntryStartParam,
  parseGuestEntryStartParam
} from "~/server/domain/guest-entry-payload";

describe("guest entry payload", () => {
  it("creates human-readable organization start params", () => {
    const startParam = createGuestEntryStartParam({
      organizationRef: "coffee-place"
    });
    const payload = parseGuestEntryStartParam(startParam);

    expect(startParam).toBe("coffee-place");
    expect(payload.organizationRef).toBe("coffee-place");
    expect(payload.contextCode).toBeUndefined();
  });

  it("adds a short context code as a start param segment", () => {
    const startParam = createGuestEntryStartParam({
      contextCode: "a7k2q",
      organizationRef: "coffee-place"
    });
    const payload = parseGuestEntryStartParam(startParam);

    expect(startParam).toBe("coffee-place__a7k2q");
    expect(payload.contextCode).toBe("a7k2q");
    expect(payload.organizationRef).toBe("coffee-place");
  });

  it("rejects context text in the start param", () => {
    expect(() => parseGuestEntryStartParam("coffee-place__stol-4")).toThrow("context code");
  });
});
