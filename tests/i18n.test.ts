import { describe, expect, it } from "vitest";

import { APP_LOCALES, createTranslator, i18nMessages, normalizeAppLocale } from "~/shared/i18n";

const collectMessagePaths = (value: unknown, prefix = ""): string[] => {
  if (typeof value === "string") {
    return [prefix];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectMessagePaths(item, prefix ? `${prefix}.${index}` : String(index))
    );
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectMessagePaths(item, prefix ? `${prefix}.${key}` : key)
    );
  }

  return [];
};

describe("shared i18n", () => {
  it("normalizes Telegram language code with English fallback", () => {
    expect(normalizeAppLocale("uz-UZ")).toBe("uz");
    expect(normalizeAppLocale("ru")).toBe("ru");
    expect(normalizeAppLocale("en-US")).toBe("en");
    expect(normalizeAppLocale("tr-TR")).toBe("tr");
    expect(normalizeAppLocale("kk-KZ")).toBe("kk");
    expect(normalizeAppLocale("uk-UA")).toBe("uk");
    expect(normalizeAppLocale(undefined)).toBe("en");
  });

  it("ships the same message keys for every supported locale", () => {
    const referencePaths = collectMessagePaths(i18nMessages.ru).sort();

    for (const locale of APP_LOCALES) {
      expect(collectMessagePaths(i18nMessages[locale]).sort()).toEqual(referencePaths);
    }
  });

  it("uses the same JSON messages for server translations", () => {
    const ru = createTranslator("ru");
    const uz = createTranslator("uz");
    const en = createTranslator("en");
    const tr = createTranslator("tr");
    const uk = createTranslator("uk");

    expect(ru("telegram.notifications.headline.complaint")).toBe("Новая жалоба");
    expect(uz("telegram.notifications.headline.complaint")).toBe("Yangi shikoyat");
    expect(en("telegram.notifications.headline.suggestion")).toBe("New suggestion");
    expect(tr("telegram.notifications.headline.suggestion")).toBe("Yeni öneri");
    expect(uk("telegram.notifications.headline.suggestion")).toBe("Нова пропозиція");
    expect(ru("telegram.notifications.fields.contact")).toBe("Контакт гостя");
    expect(ru("telegram.groupConnect.success", { organizationName: "Izoh Cafe" })).toContain(
      "Готово, я на связи"
    );
    expect(uz("telegram.groupConnect.errorInvalid")).toBe(
      "Guruhni ulab bo‘lmadi. Bildirishnomalarni ochib, guruhni yana tanlang."
    );
    expect(ru("admin.blocks.capabilities.title")).toBe("Формы");
    expect(ru("admin.blocks.staff.title")).toBe("Персонал");
    expect(ru("admin.capabilities.review.title")).toBe("Отзывы");
  });
});
