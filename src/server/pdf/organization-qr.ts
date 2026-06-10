import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import { createTranslator, type AppLocale } from "~/shared/i18n";

export type OrganizationQrPdfFormat = "a4" | "sticker";

type RenderOrganizationQrPdfInput = {
  format: OrganizationQrPdfFormat;
  locale: AppLocale;
  organizationName: string;
  url: string;
};

const collectPdf = (doc: PDFKit.PDFDocument) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

const drawCenteredText = (
  doc: PDFKit.PDFDocument,
  text: string,
  y: number,
  options: PDFKit.Mixins.TextOptions = {}
) => {
  doc.text(text, 0, y, {
    align: "center",
    width: doc.page.width,
    ...options
  });
};

export const renderOrganizationQrPdf = async ({
  format,
  locale,
  organizationName,
  url
}: RenderOrganizationQrPdfInput) => {
  const isA4 = format === "a4";
  const doc = new PDFDocument({
    margin: 0,
    size: isA4 ? "A4" : [288, 288]
  });
  const result = collectPdf(doc);
  const qr = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    type: "png",
    width: isA4 ? 320 : 150
  });
  const pageWidth = doc.page.width;
  const t = createTranslator(locale);

  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");

  if (isA4) {
    doc.roundedRect(58, 64, pageWidth - 116, 710, 28).fillAndStroke("#f5f5f7", "#e5e5ea");

    doc.fillColor("#111113").font("Helvetica-Bold").fontSize(34);
    drawCenteredText(doc, organizationName, 118);

    doc.image(qr, (pageWidth - 320) / 2, 214, {
      height: 320,
      width: 320
    });

    doc.fillColor("#111113").font("Helvetica-Bold").fontSize(24);
    drawCenteredText(doc, t("pdf.organizationQr.cta"), 572);

    doc.fillColor("#6e6e73").font("Helvetica").fontSize(14);
    doc.text(t("pdf.organizationQr.caption"), 78, 616, {
      align: "center",
      width: pageWidth - 156
    });

    doc.fillColor("#8e8e93").fontSize(11);
    drawCenteredText(doc, t("pdf.organizationQr.powered"), 742);
  } else {
    doc.roundedRect(14, 14, pageWidth - 28, pageWidth - 28, 22).fillAndStroke("#f5f5f7", "#e5e5ea");

    doc.fillColor("#111113").font("Helvetica-Bold").fontSize(17);
    drawCenteredText(doc, organizationName, 44);

    doc.image(qr, (pageWidth - 150) / 2, 82, {
      height: 150,
      width: 150
    });

    doc.fillColor("#111113").font("Helvetica-Bold").fontSize(14);
    drawCenteredText(doc, t("pdf.organizationQr.cta"), 240);
  }

  doc.end();

  return result;
};
