import { IZOH_WORDMARK_ASPECT_RATIO } from "~/shared/brand";
import { createReadableSlug } from "~/shared/slug";

export type QrVisualStyle = "rounded";
export type QrFormatId = "poster" | "stand" | "sticker" | "table";
export type QrEmojiThemeId = "calm" | "great" | "idea" | "issue" | "none" | "warm";
export type QrErrorCorrectionLevel = "H" | "Q";

export type QrPalette = {
  background: string;
  foreground: string;
  muted: string;
  paper: string;
  text: string;
};

export type QrFormat = {
  allowCaption: boolean;
  allowContext: boolean;
  allowCustomHeadline: boolean;
  allowEmoji: boolean;
  aspectRatio: string;
  captionMaxLength: number;
  compact: boolean;
  contextMaxLength: number;
  heightPt: number;
  headlineMaxLength: number;
  id: QrFormatId;
  previewWidthClassName: string;
  qrStyles: readonly QrVisualStyle[];
  widthPt: number;
};

export type QrFormatLayout = {
  captionFontSize: number;
  captionFontWeight: number;
  captionHeight: number;
  captionLineHeight: number;
  captionY: number;
  compact: boolean;
  contextFontSize: number;
  contextHeight: number;
  contextY: number;
  footerLogoHeight: number;
  footerLogoWidth: number;
  footerY: number;
  headlineFontSize: number;
  headlineHeight: number;
  headlineY: number;
  logoSize: number;
  logoY: number;
  pageHeight: number;
  pageWidth: number;
  padding: number;
  qrRadius: number;
  qrSafePadding: number;
  qrSize: number;
  qrX: number;
  qrY: number;
};

export type QrCustomColors = {
  background: string;
  paper: string;
  text: string;
};

export type QrFormatLayoutContent = {
  hasCaption?: boolean;
  hasContext?: boolean;
  hasHeadline?: boolean;
};

export type QrTemplateDraft = {
  caption: string;
  customColors: QrCustomColors;
  emojiThemeId: QrEmojiThemeId;
  formatId: QrFormatId;
  headline: string;
  qrContext: string;
  qrStyle: QrVisualStyle;
  showContext: boolean;
};

export type QrEmojiMark = {
  opacity: number;
  rotation: number;
  size: number;
  x: number;
  y: number;
};

export type QrEmojiTheme = {
  emojis: readonly string[];
  id: QrEmojiThemeId;
  previewEmoji: string;
};

export const QR_DRAFT_STORAGE_KEY = "izoh.admin.qrConstructorDraft.v2";
export const QR_CONTEXT_MAX_LENGTH = 80;

export const QR_VISUAL_STYLES = [
  "rounded"
] as const satisfies readonly QrVisualStyle[];

export const QR_FORMATS: QrFormat[] = [
  {
    allowCaption: false,
    allowContext: false,
    allowCustomHeadline: false,
    allowEmoji: true,
    aspectRatio: "1 / 1",
    captionMaxLength: 0,
    compact: true,
    contextMaxLength: 0,
    heightPt: 170,
    headlineMaxLength: 0,
    id: "sticker",
    previewWidthClassName: "max-w-[286px]",
    qrStyles: QR_VISUAL_STYLES,
    widthPt: 170
  },
  {
    allowCaption: true,
    allowContext: true,
    allowCustomHeadline: true,
    allowEmoji: true,
    id: "table",
    aspectRatio: "306 / 432",
    captionMaxLength: 76,
    compact: false,
    contextMaxLength: 52,
    heightPt: 420,
    headlineMaxLength: 34,
    previewWidthClassName: "max-w-[298px]",
    qrStyles: QR_VISUAL_STYLES,
    widthPt: 298
  },
  {
    allowCaption: true,
    allowContext: true,
    allowCustomHeadline: true,
    allowEmoji: true,
    id: "stand",
    aspectRatio: "288 / 432",
    captionMaxLength: 84,
    compact: false,
    contextMaxLength: 60,
    heightPt: 432,
    headlineMaxLength: 36,
    previewWidthClassName: "max-w-[294px]",
    qrStyles: QR_VISUAL_STYLES,
    widthPt: 288
  },
  {
    allowCaption: true,
    allowContext: true,
    allowCustomHeadline: true,
    allowEmoji: true,
    id: "poster",
    aspectRatio: "420 / 595",
    captionMaxLength: 112,
    compact: false,
    contextMaxLength: 64,
    heightPt: 595,
    headlineMaxLength: 44,
    previewWidthClassName: "max-w-[315px]",
    qrStyles: QR_VISUAL_STYLES,
    widthPt: 420
  }
];
export const QR_EMOJI_THEMES = [
  {
    emojis: [],
    id: "none",
    previewEmoji: "—"
  },
  {
    emojis: ["🥰", "🤩", "✨", "💛", "🌟", "👏", "🎉", "🫶", "🙌", "💫"],
    id: "warm",
    previewEmoji: "😍"
  },
  {
    emojis: ["😊", "👏", "✨", "👍", "💛", "😌", "🌟", "🙌", "🫶", "💬"],
    id: "great",
    previewEmoji: "🙂"
  },
  {
    emojis: ["🙂", "👌", "💬", "🤔", "🫶", "☕️", "✨", "🙃", "👍", "💭"],
    id: "calm",
    previewEmoji: "😐"
  },
  {
    emojis: ["📝", "✨", "🚀", "💡", "🎁", "⚡️", "🛋️", "🎉", "🤝", "🏷️"],
    id: "idea",
    previewEmoji: "💡"
  },
  {
    emojis: ["💬", "📝", "🤔", "💭", "🧩", "🙋", "🔎", "⚠️", "🙂", "👌"],
    id: "issue",
    previewEmoji: "😕"
  }
] as const satisfies readonly QrEmojiTheme[];

export const QR_EMOJI_THEME_BY_ID = QR_EMOJI_THEMES.reduce(
  (accumulator, theme) => ({
    ...accumulator,
    [theme.id]: theme
  }),
  {} as Record<QrEmojiThemeId, QrEmojiTheme>
);

export const QR_EMOJI_SCENES = {
  poster: [
    { opacity: 0.08, rotation: -16, size: 0.17, x: 0.1, y: 0.16 },
    { opacity: 0.075, rotation: 14, size: 0.145, x: 0.9, y: 0.14 },
    { opacity: 0.13, rotation: 9, size: 0.105, x: 0.08, y: 0.34 },
    { opacity: 0.115, rotation: -12, size: 0.1, x: 0.92, y: 0.35 },
    { opacity: 0.07, rotation: 18, size: 0.16, x: 0.08, y: 0.58 },
    { opacity: 0.12, rotation: -8, size: 0.095, x: 0.92, y: 0.62 },
    { opacity: 0.085, rotation: -18, size: 0.13, x: 0.18, y: 0.86 },
    { opacity: 0.08, rotation: 16, size: 0.13, x: 0.82, y: 0.86 },
    { opacity: 0.095, rotation: 7, size: 0.085, x: 0.5, y: 0.08 },
    { opacity: 0.075, rotation: -10, size: 0.09, x: 0.5, y: 0.92 }
  ],
  stand: [
    { opacity: 0.085, rotation: -14, size: 0.155, x: 0.12, y: 0.14 },
    { opacity: 0.08, rotation: 13, size: 0.13, x: 0.88, y: 0.12 },
    { opacity: 0.13, rotation: 10, size: 0.1, x: 0.09, y: 0.4 },
    { opacity: 0.12, rotation: -12, size: 0.095, x: 0.91, y: 0.44 },
    { opacity: 0.08, rotation: -17, size: 0.12, x: 0.15, y: 0.76 },
    { opacity: 0.085, rotation: 17, size: 0.118, x: 0.85, y: 0.78 },
    { opacity: 0.105, rotation: -8, size: 0.078, x: 0.5, y: 0.08 },
    { opacity: 0.075, rotation: 8, size: 0.08, x: 0.5, y: 0.9 }
  ],
  sticker: [
    { opacity: 0.16, rotation: -18, size: 0.115, x: 0.1, y: 0.12 },
    { opacity: 0.13, rotation: 15, size: 0.1, x: 0.9, y: 0.13 },
    { opacity: 0.12, rotation: 12, size: 0.095, x: 0.1, y: 0.88 },
    { opacity: 0.14, rotation: -14, size: 0.105, x: 0.9, y: 0.87 }
  ],
  table: [
    { opacity: 0.09, rotation: -14, size: 0.15, x: 0.12, y: 0.14 },
    { opacity: 0.08, rotation: 12, size: 0.13, x: 0.88, y: 0.12 },
    { opacity: 0.135, rotation: 10, size: 0.098, x: 0.09, y: 0.41 },
    { opacity: 0.12, rotation: -12, size: 0.094, x: 0.91, y: 0.45 },
    { opacity: 0.08, rotation: -18, size: 0.116, x: 0.15, y: 0.76 },
    { opacity: 0.085, rotation: 17, size: 0.112, x: 0.85, y: 0.78 },
    { opacity: 0.105, rotation: -7, size: 0.076, x: 0.5, y: 0.08 },
    { opacity: 0.075, rotation: 9, size: 0.078, x: 0.5, y: 0.9 }
  ]
} as const satisfies Record<QrFormatId, readonly QrEmojiMark[]>;

export const getQrEmojiScene = (formatId: QrFormatId) => QR_EMOJI_SCENES[formatId];

export const isQrFinderModule = (row: number, col: number, moduleCount: number) =>
  (row < 7 && col < 7) ||
  (row < 7 && col >= moduleCount - 7) ||
  (row >= moduleCount - 7 && col < 7);

const isQrFinderCenter = (row: number, col: number, moduleCount: number) =>
  (row === 6 && col === 6) ||
  (row === 6 && col === moduleCount - 7) ||
  (row === moduleCount - 7 && col === 6);

export const getQrAlignmentPatternCenters = (moduleCount: number) => {
  const version = (moduleCount - 17) / 4;

  if (version < 2) {
    return [];
  }

  const alignCount = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (alignCount * 2 - 2)) * 2;
  const centers = [6];

  for (let position = moduleCount - 7; centers.length < alignCount; position -= step) {
    centers.splice(1, 0, position);
  }

  return centers;
};

export const isQrAlignmentModule = (
  row: number,
  col: number,
  moduleCount: number,
  centers = getQrAlignmentPatternCenters(moduleCount)
) =>
  centers.some((centerRow) =>
    centers.some(
      (centerCol) =>
        !isQrFinderCenter(centerRow, centerCol, moduleCount) &&
        Math.abs(row - centerRow) <= 2 &&
        Math.abs(col - centerCol) <= 2
    )
  );

export const QR_DEFAULT_CUSTOM_COLORS: QrCustomColors = {
  background: "#edf5ff",
  paper: "#f8fbff",
  text: "#111827"
};

export const QR_DEFAULT_DRAFT: QrTemplateDraft = {
  caption: "",
  customColors: QR_DEFAULT_CUSTOM_COLORS,
  emojiThemeId: "warm",
  formatId: "table",
  headline: "",
  qrContext: "",
  qrStyle: "rounded",
  showContext: true
};

export const QR_FORMAT_BY_ID = Object.fromEntries(
  QR_FORMATS.map((format) => [format.id, format])
) as Record<QrFormatId, QrFormat>;

export const getQrFormat = (formatId: QrFormatId) => QR_FORMAT_BY_ID[formatId];

export const getQrFormatVisualStyle = (
  formatId: QrFormatId,
  qrStyle: QrVisualStyle
): QrVisualStyle => {
  const format = getQrFormat(formatId);

  return format.qrStyles.includes(qrStyle) ? qrStyle : format.qrStyles[0];
};

export const getQrErrorCorrectionLevel = (formatId: QrFormatId): QrErrorCorrectionLevel =>
  formatId === "sticker" ? "H" : "Q";

export const getQrFormatLayout = (
  formatId: QrFormatId,
  content: QrFormatLayoutContent = {}
): QrFormatLayout => {
  const format = getQrFormat(formatId);
  const compact = format.compact;
  const pageWidth = format.widthPt;
  const pageHeight = format.heightPt;
  const hasCaption = content.hasCaption ?? format.allowCaption;
  const hasContext = content.hasContext ?? false;
  const hasHeadline = content.hasHeadline ?? true;
  const padding = compact ? 14 : formatId === "poster" ? 34 : 24;
  const loosenContextBeforeQr =
    (formatId === "table" || formatId === "stand") && hasHeadline && hasContext;
  const baseQrSize = compact
    ? Math.min(pageWidth, pageHeight) * 0.68
    : formatId === "poster"
      ? Math.min(pageWidth * 0.54, pageHeight * 0.35)
      : Math.min(pageWidth * 0.59, pageHeight * 0.39);
  const qrSize = loosenContextBeforeQr ? baseQrSize - 8 : baseQrSize;
  const qrX = (pageWidth - qrSize) / 2;
  const baseQrY = compact
    ? (pageHeight - qrSize) / 2
    : formatId === "poster"
      ? hasHeadline
        ? pageHeight * (hasCaption ? 0.33 : 0.365)
        : pageHeight * (hasCaption ? 0.285 : 0.315)
      : hasHeadline
        ? pageHeight * (hasCaption ? 0.315 : 0.355)
        : pageHeight * (hasCaption ? 0.275 : 0.305);
  const qrY = baseQrY + (loosenContextBeforeQr ? 10 : 0);
  const captionFontSize = formatId === "poster" ? 17 : 13;
  const captionLineHeight = formatId === "poster" ? 23 : 18;
  const captionHeight = formatId === "poster" ? 92 : 60;
  const captionGap = formatId === "poster" ? 24 : 14;
  const captionFontWeight = 500;
  const logoSize = compact ? 34 : formatId === "poster" ? 66 : 52;
  const legacyLogoSize = compact ? 28 : formatId === "poster" ? 54 : 44;
  const logoY = compact
    ? 0
    : Math.max(12, padding + 2 - Math.max(0, logoSize - legacyLogoSize) / 2);
  const footerLogoWidth = compact ? 22 : formatId === "poster" ? 46 : 34;
  const footerLogoHeight = footerLogoWidth / IZOH_WORDMARK_ASPECT_RATIO;
  const footerBottomInset = compact ? 6 : formatId === "poster" ? 32 : 25;
  const headlineY = compact ? padding + 2 : padding + (formatId === "poster" ? 70 : 56);
  const headlineHeight = compact ? 18 : formatId === "poster" ? 38 : 30;
  const contextY = compact
    ? padding + 22
    : hasHeadline
      ? headlineY + headlineHeight + (formatId === "poster" ? 12 : 8)
      : Math.max(padding + logoSize + 12, qrY - (formatId === "poster" ? 42 : 34));

  return {
    captionFontSize,
    captionFontWeight,
    captionHeight,
    captionLineHeight,
    captionY: qrY + qrSize + captionGap,
    compact,
    contextFontSize: compact ? 8 : formatId === "poster" ? 16 : 11,
    contextHeight: compact ? 10 : formatId === "poster" ? 22 : 15,
    contextY,
    footerLogoHeight,
    footerLogoWidth,
    footerY: pageHeight - footerBottomInset - footerLogoHeight,
    headlineFontSize: compact ? 14 : formatId === "poster" ? 30 : 23,
    headlineHeight,
    headlineY,
    logoSize,
    logoY,
    pageHeight,
    pageWidth,
    padding,
    qrRadius: compact ? 16 : formatId === "poster" ? 20 : 18,
    qrSafePadding: compact ? 5 : 6,
    qrSize,
    qrX,
    qrY
  };
};

export const isQrFormatId = (value: unknown): value is QrFormatId =>
  typeof value === "string" && value in QR_FORMAT_BY_ID;

export const isQrVisualStyle = (value: unknown): value is QrVisualStyle =>
  typeof value === "string" && QR_VISUAL_STYLES.includes(value as QrVisualStyle);

export const isQrEmojiThemeId = (value: unknown): value is QrEmojiThemeId =>
  typeof value === "string" && value in QR_EMOJI_THEME_BY_ID;

export const normalizeQrHexColor = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;

  const color = value.trim();

  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
};

export const normalizeQrText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";

export const createQrPdfFileName = ({
  context,
  organizationName,
  organizationSlug
}: {
  context?: string;
  organizationName: string;
  organizationSlug?: string;
}) => {
  const organizationPart = createReadableSlug(organizationSlug || organizationName, {
    fallback: "izoh",
    maxLength: 64
  });
  const contextPart = createReadableSlug(context ?? "", {
    maxLength: 56
  });
  const parts = ["qr", organizationPart, contextPart].filter(Boolean);

  return `${parts.join("-")}.pdf`;
};

export const getQrPalette = (customColors: Partial<QrCustomColors> = {}): QrPalette => {
  const background = normalizeQrHexColor(
    customColors.background,
    QR_DEFAULT_CUSTOM_COLORS.background
  );
  const paper = normalizeQrHexColor(customColors.paper, QR_DEFAULT_CUSTOM_COLORS.paper);
  const text = normalizeQrHexColor(customColors.text, QR_DEFAULT_CUSTOM_COLORS.text);

  return {
    background,
    foreground: text,
    muted: text,
    paper,
    text
  };
};
