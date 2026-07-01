import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { LOCAL_MEDIA_BUCKET, getLocalMediaObjectBuffer } from "~/server/media/local-storage";
import { getR2Object } from "~/server/media/r2-client";
import { streamToBuffer } from "~/server/media/processing";
import { IZOH_WORDMARK_PATHS, IZOH_WORDMARK_WIDTH } from "~/shared/brand";
import type { AppLocale } from "~/shared/i18n";
import {
  QR_DEFAULT_DRAFT,
  QR_EMOJI_THEME_BY_ID,
  QR_FORMAT_BY_ID,
  getQrAlignmentPatternCenters,
  getQrEmojiAssetPath,
  getQrEmojiForMark,
  getQrEmojiScene,
  getQrErrorCorrectionLevel,
  getQrFormatLayout,
  getQrPalette,
  isQrAlignmentModule,
  isQrFinderModule,
  normalizeQrEmojiOpacity,
  normalizeQrText,
  type QrCustomColors,
  type QrErrorCorrectionLevel,
  type QrEmojiThemeId,
  type QrFormatId,
  type QrPalette,
  type QrVisualStyle
} from "~/shared/qr";

export type OrganizationQrPdfTemplate = {
  caption?: string;
  context?: string;
  customColors?: Partial<QrCustomColors>;
  emojiOpacity?: number;
  emojiThemeId?: QrEmojiThemeId;
  formatId?: QrFormatId;
  headline?: string;
  qrStyle?: QrVisualStyle;
  showContext?: boolean;
};

export type OrganizationQrPdfLogoAsset = {
  bucket: string;
  publicUrl?: null | string;
  storageKey: string;
};

type RenderOrganizationQrPdfInput = {
  locale: AppLocale;
  organizationLogo?: null | OrganizationQrPdfLogoAsset;
  organizationLogoUrl?: null | string;
  organizationName: string;
  template?: OrganizationQrPdfTemplate;
  url: string;
};

const collectPdf = (doc: PDFKit.PDFDocument) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

const fontRegularPath = fileURLToPath(
  new URL("../../assets/fonts/open-runde/OpenRunde-Regular.woff2", import.meta.url)
);
const fontMediumPath = fileURLToPath(
  new URL("../../assets/fonts/open-runde/OpenRunde-Medium.woff2", import.meta.url)
);
const fontSemiboldPath = fileURLToPath(
  new URL("../../assets/fonts/open-runde/OpenRunde-Semibold.woff2", import.meta.url)
);
const fontBoldPath = fileURLToPath(
  new URL("../../assets/fonts/open-runde/OpenRunde-Bold.woff2", import.meta.url)
);

const registerFonts = (doc: PDFKit.PDFDocument) => {
  doc.registerFont("OpenRunde", fontRegularPath);
  doc.registerFont("OpenRunde-Medium", fontMediumPath);
  doc.registerFont("OpenRunde-Semibold", fontSemiboldPath);
  doc.registerFont("OpenRunde-Bold", fontBoldPath);
};

const setPagePrintBoxes = (doc: PDFKit.PDFDocument, width: number, height: number) => {
  const pageDictionary = (
    doc.page as unknown as {
      dictionary?: {
        data?: Record<string, unknown>;
      };
    }
  ).dictionary;
  const pageData = pageDictionary?.data;

  if (!pageData) {
    return;
  }

  for (const boxName of ["MediaBox", "CropBox", "TrimBox", "BleedBox", "ArtBox"] as const) {
    pageData[boxName] = [0, 0, width, height];
  }

  pageData.UserUnit = 1;
};

const normalizeFontText = (value: string) => value.replace(/\s+/g, " ").trim();

const emojiImageCache = new Map<string, Promise<Buffer | null>>();
const organizationLogoImageCache = new Map<string, Promise<Buffer | null>>();

const loadEmojiImage = (emoji: string) => {
  const assetPath = getQrEmojiAssetPath(emoji);

  if (!assetPath) {
    return Promise.resolve(null);
  }

  const cached = emojiImageCache.get(assetPath);

  if (cached) {
    return cached;
  }

  const image = (async () => {
    try {
      const asset = await readFile(
        fileURLToPath(new URL(`../../../public${assetPath}`, import.meta.url))
      );

      return sharp(asset)
        .resize({
          fit: "contain",
          height: 128,
          width: 128
        })
        .png()
        .toBuffer();
    } catch {
      return null;
    }
  })();

  emojiImageCache.set(assetPath, image);

  return image;
};

const loadOrganizationLogoImage = (input?: null | string | OrganizationQrPdfLogoAsset) => {
  const source = typeof input === "string" ? { publicUrl: input } : input;
  const cleanUrl = source?.publicUrl?.trim();
  const storageKey = source && "storageKey" in source ? source.storageKey.trim() : "";
  const bucket = source && "bucket" in source ? source.bucket.trim() : "";
  const cacheKey = storageKey && bucket ? `storage:${bucket}:${storageKey}` : `url:${cleanUrl}`;

  if (!storageKey && !cleanUrl) {
    return Promise.resolve(null);
  }

  const cached = organizationLogoImageCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const image = (async () => {
    try {
      const buffer =
        storageKey && bucket
          ? bucket === LOCAL_MEDIA_BUCKET
            ? await getLocalMediaObjectBuffer(storageKey)
            : await getR2Object(storageKey).then((object) => streamToBuffer(object.Body))
          : await (async () => {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 2500);

              try {
                const response = await fetch(cleanUrl!, {
                  signal: controller.signal
                });

                if (!response.ok) {
                  return null;
                }

                return Buffer.from(await response.arrayBuffer());
              } finally {
                clearTimeout(timeout);
              }
            })();

      if (!buffer) {
        organizationLogoImageCache.delete(cacheKey);
        return null;
      }

      return sharp(buffer)
        .rotate()
        .resize({
          fit: "cover",
          height: 192,
          width: 192
        })
        .png()
        .toBuffer();
    } catch {
      organizationLogoImageCache.delete(cacheKey);
      return null;
    }
  })();

  organizationLogoImageCache.set(cacheKey, image);

  return image;
};

const drawCenteredText = (
  doc: PDFKit.PDFDocument,
  text: string,
  y: number,
  width: number,
  options: PDFKit.Mixins.TextOptions = {}
) => {
  doc.text(text, 0, y, {
    align: "center",
    width,
    ...options
  });
};

const createRoundedModulePath = (
  x: number,
  y: number,
  size: number,
  radius: number,
  corners: {
    bottomLeft: boolean;
    bottomRight: boolean;
    topLeft: boolean;
    topRight: boolean;
  }
) => {
  const x2 = x + size;
  const y2 = y + size;
  const topLeftRadius = corners.topLeft ? radius : 0;
  const topRightRadius = corners.topRight ? radius : 0;
  const bottomRightRadius = corners.bottomRight ? radius : 0;
  const bottomLeftRadius = corners.bottomLeft ? radius : 0;

  return [
    `M ${x + topLeftRadius} ${y}`,
    `H ${x2 - topRightRadius}`,
    topRightRadius ? `Q ${x2} ${y} ${x2} ${y + topRightRadius}` : `L ${x2} ${y}`,
    `V ${y2 - bottomRightRadius}`,
    bottomRightRadius ? `Q ${x2} ${y2} ${x2 - bottomRightRadius} ${y2}` : `L ${x2} ${y2}`,
    `H ${x + bottomLeftRadius}`,
    bottomLeftRadius ? `Q ${x} ${y2} ${x} ${y2 - bottomLeftRadius}` : `L ${x} ${y2}`,
    `V ${y + topLeftRadius}`,
    topLeftRadius ? `Q ${x} ${y} ${x + topLeftRadius} ${y}` : `L ${x} ${y}`,
    "Z"
  ].join(" ");
};

const drawFinderPattern = ({
  doc,
  moduleSize,
  palette,
  x,
  y
}: {
  doc: PDFKit.PDFDocument;
  moduleSize: number;
  palette: QrPalette;
  x: number;
  y: number;
}) => {
  doc.roundedRect(x, y, moduleSize * 7, moduleSize * 7, moduleSize * 2.2).fill(palette.foreground);
  doc
    .roundedRect(x + moduleSize, y + moduleSize, moduleSize * 5, moduleSize * 5, moduleSize * 1.65)
    .fill(palette.paper);
  doc
    .roundedRect(
      x + moduleSize * 2,
      y + moduleSize * 2,
      moduleSize * 3,
      moduleSize * 3,
      moduleSize * 0.86
    )
    .fill(palette.foreground);
};

const drawAlignmentPattern = ({
  doc,
  moduleSize,
  palette,
  x,
  y
}: {
  doc: PDFKit.PDFDocument;
  moduleSize: number;
  palette: QrPalette;
  x: number;
  y: number;
}) => {
  doc.roundedRect(x, y, moduleSize * 5, moduleSize * 5, moduleSize * 1.35).fill(palette.foreground);
  doc
    .roundedRect(x + moduleSize, y + moduleSize, moduleSize * 3, moduleSize * 3, moduleSize * 0.84)
    .fill(palette.paper);
  doc
    .roundedRect(x + moduleSize * 2, y + moduleSize * 2, moduleSize, moduleSize, moduleSize * 0.28)
    .fill(palette.foreground);
};

const drawQrMatrix = ({
  doc,
  errorCorrectionLevel,
  palette,
  qrSize,
  url,
  x,
  y
}: {
  doc: PDFKit.PDFDocument;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  palette: QrPalette;
  qrSize: number;
  url: string;
  x: number;
  y: number;
}) => {
  const qr = QRCode.create(url, {
    errorCorrectionLevel
  });
  const quietZone = 4;
  const moduleCount = qr.modules.size;
  const totalSize = moduleCount + quietZone * 2;
  const moduleSize = qrSize / totalSize;
  const alignmentCenters = getQrAlignmentPatternCenters(moduleCount);
  const isStyledPatternModule = (row: number, col: number) =>
    isQrFinderModule(row, col, moduleCount) ||
    isQrAlignmentModule(row, col, moduleCount, alignmentCenters);
  const isDarkDataModule = (row: number, col: number) =>
    row >= 0 &&
    col >= 0 &&
    row < moduleCount &&
    col < moduleCount &&
    qr.modules.get(row, col) &&
    !isStyledPatternModule(row, col);

  doc.save();
  doc.rect(x, y, qrSize, qrSize).fill(palette.paper);
  doc.fillColor(palette.foreground);

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!isDarkDataModule(row, col)) continue;

      const moduleX = x + (col + quietZone) * moduleSize;
      const moduleY = y + (row + quietZone) * moduleSize;
      const hasTop = isDarkDataModule(row - 1, col);
      const hasRight = isDarkDataModule(row, col + 1);
      const hasBottom = isDarkDataModule(row + 1, col);
      const hasLeft = isDarkDataModule(row, col - 1);

      doc
        .path(
          createRoundedModulePath(moduleX, moduleY, moduleSize, moduleSize * 0.42, {
            bottomLeft: !hasBottom && !hasLeft,
            bottomRight: !hasBottom && !hasRight,
            topLeft: !hasTop && !hasLeft,
            topRight: !hasTop && !hasRight
          })
        )
        .fill(palette.foreground);
    }
  }

  for (const centerRow of alignmentCenters) {
    for (const centerCol of alignmentCenters) {
      if (
        (centerRow === 6 && centerCol === 6) ||
        (centerRow === 6 && centerCol === moduleCount - 7) ||
        (centerRow === moduleCount - 7 && centerCol === 6)
      ) {
        continue;
      }

      drawAlignmentPattern({
        doc,
        moduleSize,
        palette,
        x: x + (centerCol + quietZone - 2) * moduleSize,
        y: y + (centerRow + quietZone - 2) * moduleSize
      });
    }
  }

  drawFinderPattern({
    doc,
    moduleSize,
    palette,
    x: x + quietZone * moduleSize,
    y: y + quietZone * moduleSize
  });
  drawFinderPattern({
    doc,
    moduleSize,
    palette,
    x: x + (quietZone + moduleCount - 7) * moduleSize,
    y: y + quietZone * moduleSize
  });
  drawFinderPattern({
    doc,
    moduleSize,
    palette,
    x: x + quietZone * moduleSize,
    y: y + (quietZone + moduleCount - 7) * moduleSize
  });

  doc.restore();
};

const drawLogo = ({
  doc,
  image,
  name,
  palette,
  padding = 0,
  paddingColor,
  size,
  x,
  y
}: {
  doc: PDFKit.PDFDocument;
  image?: Buffer | null;
  name: string;
  palette: QrPalette;
  padding?: number;
  paddingColor?: string;
  size: number;
  x: number;
  y: number;
}) => {
  const radius = size / 2;
  const centerX = x + radius;
  const centerY = y + radius;

  doc.save();

  if (padding > 0) {
    doc.circle(centerX, centerY, radius + padding).fill(paddingColor ?? palette.paper);
  }

  if (image) {
    doc.save();
    doc.circle(centerX, centerY, radius).clip();
    doc.image(image, x, y, {
      height: size,
      width: size
    });
    doc.restore();
    doc.restore();

    return;
  }

  doc.circle(centerX, centerY, radius).fill(palette.text);
  doc
    .fillColor(palette.paper)
    .font("OpenRunde-Bold")
    .fontSize(size * 0.46)
    .text((name.trim().slice(0, 1).toUpperCase() || "I").slice(0, 1), x, y + size * 0.25, {
      align: "center",
      width: size
    });
  doc.restore();
};

const drawIzohWordmark = ({
  color,
  doc,
  opacity = 0.54,
  width,
  x,
  y
}: {
  color: string;
  doc: PDFKit.PDFDocument;
  opacity?: number;
  width: number;
  x: number;
  y: number;
}) => {
  const scale = width / IZOH_WORDMARK_WIDTH;

  doc.save();
  doc.translate(x, y);
  doc.scale(scale);
  doc.opacity(opacity);
  doc.fillColor(color);

  for (const path of IZOH_WORDMARK_PATHS) {
    doc.path(path).fill();
  }

  doc.restore();
};

export const renderOrganizationQrPdf = async ({
  locale: _locale,
  organizationLogo,
  organizationLogoUrl,
  organizationName,
  template = {},
  url
}: RenderOrganizationQrPdfInput) => {
  const format = QR_FORMAT_BY_ID[template.formatId ?? QR_DEFAULT_DRAFT.formatId];
  const palette = getQrPalette({
    ...QR_DEFAULT_DRAFT.customColors,
    ...template.customColors
  });
  const emojiTheme = QR_EMOJI_THEME_BY_ID[template.emojiThemeId ?? QR_DEFAULT_DRAFT.emojiThemeId];
  const emojiOpacity = normalizeQrEmojiOpacity(template.emojiOpacity);
  const showEmoji = format.allowEmoji && emojiTheme.id !== "none";
  const headline = format.compact
    ? ""
    : format.allowCustomHeadline
      ? normalizeFontText(normalizeQrText(template.headline, format.headlineMaxLength))
      : normalizeFontText(organizationName);
  const context =
    format.allowContext && template.showContext !== false
      ? normalizeFontText(normalizeQrText(template.context, format.contextMaxLength))
      : "";
  const emojiSeed = `${format.id}:${emojiTheme.id}:${organizationName}:${context}:${url}`;
  const caption = format.allowCaption
    ? normalizeFontText(normalizeQrText(template.caption, format.captionMaxLength))
    : "";
  const layout = getQrFormatLayout(format.id, {
    hasCaption: Boolean(caption),
    hasContext: Boolean(context),
    hasHeadline: Boolean(headline)
  });
  const compact = layout.compact;
  const doc = new PDFDocument({
    margin: 0,
    size: [format.widthPt, format.heightPt]
  });
  const result = collectPdf(doc);
  setPagePrintBoxes(doc, format.widthPt, format.heightPt);
  registerFonts(doc);
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const emojiMarks = getQrEmojiScene(format.id, layout, {
    hasCaption: Boolean(caption),
    hasContext: Boolean(context),
    hasHeadline: Boolean(headline)
  });
  const background = palette.background;
  const textColor = palette.text;
  const mutedColor = palette.muted;
  const padding = layout.padding;
  const qrSize = layout.qrSize;
  const qrX = layout.qrX;
  const qrY = layout.qrY;
  const logoImagePromise = loadOrganizationLogoImage(organizationLogo ?? organizationLogoUrl);
  const emojiImagePromises = showEmoji
    ? emojiMarks.map((mark, index) =>
        loadEmojiImage(
          getQrEmojiForMark({
            emojiTheme,
            formatId: format.id,
            index,
            mark,
            seed: emojiSeed
          })
        )
      )
    : [];
  const compactLogoPadding = Math.max(3, layout.logoSize * 0.16);
  const errorCorrectionLevel = getQrErrorCorrectionLevel(format.id);
  const [logoImage, emojiImages] = await Promise.all([
    logoImagePromise,
    Promise.all(emojiImagePromises)
  ]);

  doc.rect(0, 0, pageWidth, pageHeight).fill(background);

  if (showEmoji) {
    for (const [index, mark] of emojiMarks.entries()) {
      const image = emojiImages[index];

      if (!image) {
        continue;
      }

      const size = Math.min(pageWidth, pageHeight) * mark.size;

      const centerX = pageWidth * mark.x;
      const centerY = pageHeight * mark.y;

      doc.save();
      doc.opacity(Math.min(1, mark.opacity * emojiOpacity));
      doc.rotate(mark.rotation, {
        origin: [centerX, centerY]
      });
      doc.image(image, centerX - size / 2, centerY - size / 2, {
        height: size,
        width: size
      });
      doc.restore();
    }
  }

  if (!compact) {
    drawLogo({
      doc,
      image: logoImage,
      name: organizationName,
      palette,
      size: layout.logoSize,
      x: (pageWidth - layout.logoSize) / 2,
      y: layout.logoY
    });
  }

  if (headline) {
    doc.fillColor(textColor).font("OpenRunde-Bold").fontSize(layout.headlineFontSize);
    drawCenteredText(doc, headline, layout.headlineY, pageWidth, {
      ellipsis: true,
      height: layout.headlineHeight
    });
  }

  if (context) {
    doc.fillColor(mutedColor).font("OpenRunde-Semibold").fontSize(layout.contextFontSize);
    drawCenteredText(doc, context, layout.contextY, pageWidth, {
      ellipsis: true,
      height: layout.contextHeight
    });
  }

  doc.save();
  doc
    .roundedRect(
      qrX - layout.qrSafePadding,
      qrY - layout.qrSafePadding,
      qrSize + layout.qrSafePadding * 2,
      qrSize + layout.qrSafePadding * 2,
      layout.qrRadius
    )
    .fill(palette.paper);
  doc.restore();
  drawQrMatrix({
    doc,
    errorCorrectionLevel,
    palette,
    qrSize,
    url,
    x: qrX,
    y: qrY
  });

  if (compact) {
    drawLogo({
      doc,
      image: logoImage,
      name: organizationName,
      padding: compactLogoPadding,
      paddingColor: palette.paper,
      palette,
      size: layout.logoSize,
      x: (pageWidth - layout.logoSize) / 2,
      y: qrY + qrSize / 2 - layout.logoSize / 2
    });
  } else if (format.allowCaption && caption) {
    doc.fillColor(mutedColor).font("OpenRunde-Medium").fontSize(layout.captionFontSize);
    doc.text(caption, padding, layout.captionY, {
      align: "center",
      height: layout.captionHeight,
      lineGap: Math.max(0, layout.captionLineHeight - layout.captionFontSize),
      width: pageWidth - padding * 2
    });
  }

  if (layout.footerLogoWidth > 0) {
    drawIzohWordmark({
      color: palette.muted,
      doc,
      opacity: compact ? 0.44 : undefined,
      width: layout.footerLogoWidth,
      x: (pageWidth - layout.footerLogoWidth) / 2,
      y: layout.footerY
    });
  }

  doc.end();

  return result;
};
