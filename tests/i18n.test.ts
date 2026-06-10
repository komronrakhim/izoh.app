import { describe, expect, it } from "vitest";

import { createTranslator, normalizeAppLocale } from "~/shared/i18n";

describe("shared i18n", () => {
  it("normalizes Telegram language code with Russian fallback", () => {
    expect(normalizeAppLocale("uz-UZ")).toBe("uz");
    expect(normalizeAppLocale("ru")).toBe("ru");
    expect(normalizeAppLocale("en-US")).toBe("ru");
    expect(normalizeAppLocale(undefined)).toBe("ru");
  });

  it("uses the same JSON messages for server translations", () => {
    const ru = createTranslator("ru");
    const uz = createTranslator("uz");

    expect(ru("telegram.notifications.kind.complaint")).toBe("Жалоба");
    expect(uz("telegram.notifications.kind.complaint")).toBe("Shikoyat");
    expect(ru("admin.blocks.capabilities.title")).toBe("Формы");
    expect(ru("admin.blocks.staff.title")).toBe("Персонал");
    expect(ru("admin.capabilities.review.title")).toBe("Отзывы");
  });
});
