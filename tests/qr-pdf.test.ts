import { describe, expect, it } from "vitest";

import { renderOrganizationQrPdf } from "~/server/pdf";
import { QR_FORMATS, createQrPdfFileName } from "~/shared/qr";

describe("organization QR PDF", () => {
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
        emojiEnabled: true,
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
          emojiEnabled: true,
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
