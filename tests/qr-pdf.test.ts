import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { LOCAL_MEDIA_BUCKET, deleteLocalMediaObject, putLocalMediaObject } from "~/server/media";
import { renderOrganizationQrPdf } from "~/server/pdf";
import {
  QR_EMOJI_THEMES,
  QR_FORMATS,
  QR_FORMAT_BY_ID,
  createQrPdfFileName,
  getQrEmojiAssetPath,
  getQrEmojiScene,
  getQrFormatLayout
} from "~/shared/qr";

const ptToMm = (value: number) => (value * 25.4) / 72;

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

  it("embeds an organization logo from local media storage", async () => {
    const storageKey = `tests/qr-logo-${Date.now()}.png`;
    const logo = await sharp({
      create: {
        background: "#6817ff",
        channels: 3,
        height: 256,
        width: 256
      }
    })
      .png()
      .toBuffer();

    await putLocalMediaObject({
      body: logo,
      contentType: "image/png",
      key: storageKey
    });

    try {
      const pdf = await renderOrganizationQrPdf({
        locale: "ru",
        organizationLogo: {
          bucket: LOCAL_MEDIA_BUCKET,
          publicUrl: `/api/media/local-assets?key=${encodeURIComponent(storageKey)}`,
          storageKey
        },
        organizationName: "Izoh Test",
        template: {
          caption: "Гости могут быстро оставить обращение.",
          emojiThemeId: "none",
          formatId: "table",
          qrStyle: "rounded"
        },
        url: "https://t.me/izohappbot/app?startapp=izoh-test.logo"
      });

      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    } finally {
      await deleteLocalMediaObject(storageKey);
    }
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

      const pdfText = pdf.toString("latin1");
      const expectedBox = `[0 0 ${format.widthPt} ${format.heightPt}]`;

      for (const boxName of ["MediaBox", "CropBox", "TrimBox", "BleedBox", "ArtBox"]) {
        expect(pdfText).toContain(`/${boxName} ${expectedBox}`);
      }
    }
  });

  it("matches declared print format sizes", () => {
    expect(ptToMm(QR_FORMAT_BY_ID.table.widthPt)).toBeCloseTo(105, 2);
    expect(ptToMm(QR_FORMAT_BY_ID.table.heightPt)).toBeCloseTo(148, 2);

    expect(QR_FORMAT_BY_ID.stand.widthPt).toBe(288);
    expect(QR_FORMAT_BY_ID.stand.heightPt).toBe(432);

    expect(ptToMm(QR_FORMAT_BY_ID.poster.widthPt)).toBeCloseTo(148, 2);
    expect(ptToMm(QR_FORMAT_BY_ID.poster.heightPt)).toBeCloseTo(210, 2);

    expect(ptToMm(QR_FORMAT_BY_ID.sticker.widthPt)).toBeCloseTo(60, 2);
    expect(ptToMm(QR_FORMAT_BY_ID.sticker.heightPt)).toBeCloseTo(60, 2);
  });
});
