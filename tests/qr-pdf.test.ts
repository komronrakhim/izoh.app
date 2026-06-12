import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderOrganizationQrPdf } from "~/server/pdf";
import {
  QR_EMOJI_THEMES,
  QR_FORMATS,
  createQrPdfFileName,
  getQrEmojiAssetPath,
  getQrEmojiScene,
  getQrFormatLayout
} from "~/shared/qr";

describe("organization QR PDF", () => {
  it("maps QR emoji themes to local Fluent assets", () => {
    for (const theme of QR_EMOJI_THEMES) {
      if (theme.id === "none") continue;

      for (const emoji of [theme.previewEmoji, ...theme.emojis]) {
        const assetPath = getQrEmojiAssetPath(emoji);

        expect(assetPath, emoji).toBeTruthy();
        expect(existsSync(fileURLToPath(new URL(`../public${assetPath}`, import.meta.url)))).toBe(
          true
        );
      }
    }
  });

  it("creates readable QR PDF filenames with context", () => {
    expect(
      createQrPdfFileName({
        context: "Стол 5",
        organizationName: "Кофейня Рахимов"
      })
    ).toBe("qr-kofeynya-rakhimov-stol-5.pdf");
    expect(
      createQrPdfFileName({
        context: "",
        organizationName: "😄",
        organizationSlug: "izoh-test"
      })
    ).toBe("qr-izoh-test.pdf");
  });

  it("keeps enough emoji scene marks after layout safe zones", () => {
    const minimums = {
      poster: 8,
      stand: 6,
      sticker: 6,
      table: 8
    } as const;

    for (const format of QR_FORMATS) {
      const content = {
        hasCaption: format.allowCaption,
        hasContext: format.allowContext,
        hasHeadline: !format.compact
      };
      const layout = getQrFormatLayout(format.id, content);

      expect(getQrEmojiScene(format.id, layout, content).length).toBeGreaterThanOrEqual(
        minimums[format.id]
      );
    }
  });

  it("renders a customized QR poster PDF", async () => {
    const pdf = await renderOrganizationQrPdf({
      locale: "ru",
      organizationName: "Кофейня Рахимов",
      template: {
        caption: "Поделитесь впечатлением, это поможет команде стать лучше.",
        context: "Стол 4",
        customColors: {
          background: "#fff0f4",
          paper: "#ffffff",
          text: "#3b0a14"
        },
        emojiThemeId: "warm",
        formatId: "table",
        qrStyle: "rounded"
      },
      url: "https://t.me/izohappbot/app?startapp=kofeynya-rahimov.s4"
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(20_000);
  });

  it("renders every QR print format", async () => {
    for (const format of QR_FORMATS) {
      const pdf = await renderOrganizationQrPdf({
        locale: "ru",
        organizationName: "Izoh Test",
        template: {
          caption: "Гости могут быстро оставить обращение.",
          context: "Стол 4",
          formatId: format.id,
          qrStyle: "rounded"
        },
        url: `https://t.me/izohappbot/app?startapp=izoh-test.${format.id}`
      });

      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdf.length).toBeGreaterThan(10_000);
    }
  });
});
