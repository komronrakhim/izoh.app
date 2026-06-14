import { IZOH_WORDMARK_ASPECT_RATIO } from "~/shared/brand";
import { createReadableSlug } from "~/shared/slug";

export type QrVisualStyle = "rounded";
export type QrFormatId = "poster" | "stand" | "sticker" | "table";
export type QrEmojiThemeId = "calm" | "great" | "idea" | "issue" | "none" | "warm";
export type QrEmojiOpacityPresetId = "bright" | "maximum" | "soft" | "visible";
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
  emojiOpacity: number;
  emojiThemeId: QrEmojiThemeId;
  formatId: QrFormatId;
  headline: string;
  qrContext: string;
  qrStyle: QrVisualStyle;
  showContext: boolean;
};

export type QrEmojiMark = {
  depth?: "accent" | "ambient";
  emojiIndex?: number;
  emojiIndexes?: readonly number[];
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

export type QrEmojiSceneContent = {
  hasCaption?: boolean;
  hasContext?: boolean;
  hasHeadline?: boolean;
};

export const QR_DRAFT_STORAGE_KEY = "izoh.admin.qrConstructorDraft";
export const QR_CONTEXT_MAX_LENGTH = 80;
export const QR_EMOJI_ASSET_BASE_PATH = "/emoji/fluent-3d";
export const QR_EMOJI_OPACITY_DEFAULT = 1.75;
export const QR_EMOJI_OPACITY_MAX = 3.2;
export const QR_EMOJI_OPACITY_MIN = 1.15;

const PDF_POINTS_PER_INCH = 72;
const PDF_POINTS_PER_MM = PDF_POINTS_PER_INCH / 25.4;
const toPdfPoints = (value: number) => Number(value.toFixed(3));
const mmToPdfPoints = (value: number) => toPdfPoints(value * PDF_POINTS_PER_MM);
const inchesToPdfPoints = (value: number) => toPdfPoints(value * PDF_POINTS_PER_INCH);

export const QR_EMOJI_OPACITY_PRESETS = [
  { id: "soft", opacity: 1.15 },
  { id: "visible", opacity: QR_EMOJI_OPACITY_DEFAULT },
  { id: "bright", opacity: 2.45 },
  { id: "maximum", opacity: QR_EMOJI_OPACITY_MAX }
] as const satisfies readonly {
  id: QrEmojiOpacityPresetId;
  opacity: number;
}[];

export const QR_EMOJI_OPACITY_PRESET_BY_ID = QR_EMOJI_OPACITY_PRESETS.reduce(
  (accumulator, preset) => ({
    ...accumulator,
    [preset.id]: preset
  }),
  {} as Record<QrEmojiOpacityPresetId, (typeof QR_EMOJI_OPACITY_PRESETS)[number]>
);

export const QR_VISUAL_STYLES = ["rounded"] as const satisfies readonly QrVisualStyle[];

export const QR_FORMATS: QrFormat[] = [
  {
    allowCaption: true,
    allowContext: true,
    allowCustomHeadline: true,
    allowEmoji: true,
    id: "table",
    aspectRatio: "105 / 148",
    captionMaxLength: 76,
    compact: false,
    contextMaxLength: 52,
    heightPt: mmToPdfPoints(148),
    headlineMaxLength: 34,
    previewWidthClassName: "max-w-[298px]",
    qrStyles: QR_VISUAL_STYLES,
    widthPt: mmToPdfPoints(105)
  },
  {
    allowCaption: true,
    allowContext: true,
    allowCustomHeadline: true,
    allowEmoji: true,
    id: "stand",
    aspectRatio: "4 / 6",
    captionMaxLength: 84,
    compact: false,
    contextMaxLength: 60,
    heightPt: inchesToPdfPoints(6),
    headlineMaxLength: 36,
    previewWidthClassName: "max-w-[294px]",
    qrStyles: QR_VISUAL_STYLES,
    widthPt: inchesToPdfPoints(4)
  },
  {
    allowCaption: true,
    allowContext: true,
    allowCustomHeadline: true,
    allowEmoji: true,
    id: "poster",
    aspectRatio: "148 / 210",
    captionMaxLength: 112,
    compact: false,
    contextMaxLength: 64,
    heightPt: mmToPdfPoints(210),
    headlineMaxLength: 44,
    previewWidthClassName: "max-w-[315px]",
    qrStyles: QR_VISUAL_STYLES,
    widthPt: mmToPdfPoints(148)
  },
  {
    allowCaption: false,
    allowContext: false,
    allowCustomHeadline: false,
    allowEmoji: true,
    aspectRatio: "1 / 1",
    captionMaxLength: 0,
    compact: true,
    contextMaxLength: 0,
    heightPt: mmToPdfPoints(60),
    headlineMaxLength: 0,
    id: "sticker",
    previewWidthClassName: "max-w-[286px]",
    qrStyles: QR_VISUAL_STYLES,
    widthPt: mmToPdfPoints(60)
  }
];
export const QR_EMOJI_THEMES = [
  {
    emojis: [],
    id: "none",
    previewEmoji: "—"
  },
  {
    emojis: [
      "🥰",
      "🤩",
      "✨",
      "💛",
      "🌟",
      "👏",
      "🎉",
      "🫶",
      "😊",
      "💫",
      "😍",
      "❤️",
      "💖",
      "🌈",
      "🌸",
      "🤗",
      "😄",
      "🥳",
      "💕",
      "💗",
      "☀️",
      "💝"
    ],
    id: "warm",
    previewEmoji: "😍"
  },
  {
    emojis: [
      "😊",
      "👏",
      "✨",
      "👍",
      "💛",
      "😌",
      "🌟",
      "🎉",
      "🫶",
      "💬",
      "😍",
      "🥳",
      "💯",
      "⭐️",
      "🏆",
      "✅",
      "😄",
      "😃",
      "🙌",
      "❤️",
      "🚀",
      "💫"
    ],
    id: "great",
    previewEmoji: "🙂"
  },
  {
    emojis: [
      "🙂",
      "👌",
      "💬",
      "🤔",
      "🫶",
      "☕️",
      "✨",
      "🙃",
      "👍",
      "💭",
      "😌",
      "🤍",
      "🌿",
      "🍃",
      "🫖",
      "🪴",
      "💚",
      "🌸",
      "⭐️",
      "🤗"
    ],
    id: "calm",
    previewEmoji: "😐"
  },
  {
    emojis: [
      "📝",
      "✨",
      "🚀",
      "💡",
      "🎁",
      "⚡️",
      "🛋️",
      "🎉",
      "🤝",
      "🏷️",
      "🧠",
      "🔥",
      "📌",
      "🎯",
      "📣",
      "🪄",
      "🧪",
      "📎",
      "✅",
      "💫",
      "⭐️",
      "💬"
    ],
    id: "idea",
    previewEmoji: "💡"
  },
  {
    emojis: [
      "💬",
      "📝",
      "🤔",
      "💭",
      "🧩",
      "🙋",
      "🔎",
      "⚠️",
      "🙂",
      "👌",
      "🛠️",
      "🔧",
      "🚧",
      "❗",
      "❓",
      "📍",
      "✅",
      "🧯",
      "💡",
      "📌"
    ],
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

export const QR_EMOJI_ASSET_PATH_BY_EMOJI: Record<string, string> = {
  "⚠": `${QR_EMOJI_ASSET_BASE_PATH}/warning.png`,
  "⚠️": `${QR_EMOJI_ASSET_BASE_PATH}/warning.png`,
  "⚡": `${QR_EMOJI_ASSET_BASE_PATH}/high_voltage.png`,
  "⚡️": `${QR_EMOJI_ASSET_BASE_PATH}/high_voltage.png`,
  "☀": `${QR_EMOJI_ASSET_BASE_PATH}/sun.png`,
  "☀️": `${QR_EMOJI_ASSET_BASE_PATH}/sun.png`,
  "☕": `${QR_EMOJI_ASSET_BASE_PATH}/hot_beverage.png`,
  "☕️": `${QR_EMOJI_ASSET_BASE_PATH}/hot_beverage.png`,
  "✅": `${QR_EMOJI_ASSET_BASE_PATH}/check_mark_button.png`,
  "❓": `${QR_EMOJI_ASSET_BASE_PATH}/red_question_mark.png`,
  "❗": `${QR_EMOJI_ASSET_BASE_PATH}/red_exclamation_mark.png`,
  "⭐": `${QR_EMOJI_ASSET_BASE_PATH}/star.png`,
  "⭐️": `${QR_EMOJI_ASSET_BASE_PATH}/star.png`,
  "✨": `${QR_EMOJI_ASSET_BASE_PATH}/sparkles.png`,
  "🌈": `${QR_EMOJI_ASSET_BASE_PATH}/rainbow.png`,
  "🌟": `${QR_EMOJI_ASSET_BASE_PATH}/glowing_star.png`,
  "🌸": `${QR_EMOJI_ASSET_BASE_PATH}/cherry_blossom.png`,
  "🌿": `${QR_EMOJI_ASSET_BASE_PATH}/herb.png`,
  "🍃": `${QR_EMOJI_ASSET_BASE_PATH}/leaf_fluttering_in_wind.png`,
  "👌": `${QR_EMOJI_ASSET_BASE_PATH}/ok_hand.png`,
  "👍": `${QR_EMOJI_ASSET_BASE_PATH}/thumbs_up.png`,
  "👏": `${QR_EMOJI_ASSET_BASE_PATH}/clapping_hands.png`,
  "💚": `${QR_EMOJI_ASSET_BASE_PATH}/green_heart.png`,
  "💡": `${QR_EMOJI_ASSET_BASE_PATH}/light_bulb.png`,
  "💛": `${QR_EMOJI_ASSET_BASE_PATH}/yellow_heart.png`,
  "💬": `${QR_EMOJI_ASSET_BASE_PATH}/speech_balloon.png`,
  "💫": `${QR_EMOJI_ASSET_BASE_PATH}/dizzy.png`,
  "💭": `${QR_EMOJI_ASSET_BASE_PATH}/thought_balloon.png`,
  "💯": `${QR_EMOJI_ASSET_BASE_PATH}/hundred_points.png`,
  "💖": `${QR_EMOJI_ASSET_BASE_PATH}/sparkling_heart.png`,
  "💗": `${QR_EMOJI_ASSET_BASE_PATH}/growing_heart.png`,
  "💕": `${QR_EMOJI_ASSET_BASE_PATH}/two_hearts.png`,
  "💝": `${QR_EMOJI_ASSET_BASE_PATH}/heart_with_ribbon.png`,
  "🎁": `${QR_EMOJI_ASSET_BASE_PATH}/wrapped_gift.png`,
  "🎉": `${QR_EMOJI_ASSET_BASE_PATH}/party_popper.png`,
  "🎯": `${QR_EMOJI_ASSET_BASE_PATH}/bullseye.png`,
  "🏆": `${QR_EMOJI_ASSET_BASE_PATH}/trophy.png`,
  "🏷": `${QR_EMOJI_ASSET_BASE_PATH}/label.png`,
  "🏷️": `${QR_EMOJI_ASSET_BASE_PATH}/label.png`,
  "❤️": `${QR_EMOJI_ASSET_BASE_PATH}/red_heart.png`,
  "🤍": `${QR_EMOJI_ASSET_BASE_PATH}/white_heart.png`,
  "🛋": `${QR_EMOJI_ASSET_BASE_PATH}/couch_and_lamp.png`,
  "🛋️": `${QR_EMOJI_ASSET_BASE_PATH}/couch_and_lamp.png`,
  "🛠": `${QR_EMOJI_ASSET_BASE_PATH}/hammer_and_wrench.png`,
  "🛠️": `${QR_EMOJI_ASSET_BASE_PATH}/hammer_and_wrench.png`,
  "🧠": `${QR_EMOJI_ASSET_BASE_PATH}/brain.png`,
  "🧩": `${QR_EMOJI_ASSET_BASE_PATH}/puzzle_piece.png`,
  "🧪": `${QR_EMOJI_ASSET_BASE_PATH}/test_tube.png`,
  "🧯": `${QR_EMOJI_ASSET_BASE_PATH}/fire_extinguisher.png`,
  "🪄": `${QR_EMOJI_ASSET_BASE_PATH}/magic_wand.png`,
  "🪴": `${QR_EMOJI_ASSET_BASE_PATH}/potted_plant.png`,
  "🫖": `${QR_EMOJI_ASSET_BASE_PATH}/teapot.png`,
  "📝": `${QR_EMOJI_ASSET_BASE_PATH}/memo.png`,
  "📌": `${QR_EMOJI_ASSET_BASE_PATH}/pushpin.png`,
  "📍": `${QR_EMOJI_ASSET_BASE_PATH}/round_pushpin.png`,
  "📎": `${QR_EMOJI_ASSET_BASE_PATH}/paperclip.png`,
  "📣": `${QR_EMOJI_ASSET_BASE_PATH}/megaphone.png`,
  "🔥": `${QR_EMOJI_ASSET_BASE_PATH}/fire.png`,
  "🔎": `${QR_EMOJI_ASSET_BASE_PATH}/magnifying_glass_tilted_right.png`,
  "🔧": `${QR_EMOJI_ASSET_BASE_PATH}/wrench.png`,
  "🚀": `${QR_EMOJI_ASSET_BASE_PATH}/rocket.png`,
  "🚧": `${QR_EMOJI_ASSET_BASE_PATH}/construction.png`,
  "🙂": `${QR_EMOJI_ASSET_BASE_PATH}/slightly_smiling_face.png`,
  "🙃": `${QR_EMOJI_ASSET_BASE_PATH}/upside_down_face.png`,
  "🙌": `${QR_EMOJI_ASSET_BASE_PATH}/raising_hands.png`,
  "🙋": `${QR_EMOJI_ASSET_BASE_PATH}/person_raising_hand.png`,
  "😊": `${QR_EMOJI_ASSET_BASE_PATH}/smiling_face_with_smiling_eyes.png`,
  "😃": `${QR_EMOJI_ASSET_BASE_PATH}/grinning_face_with_big_eyes.png`,
  "😄": `${QR_EMOJI_ASSET_BASE_PATH}/grinning_face_with_smiling_eyes.png`,
  "😐": `${QR_EMOJI_ASSET_BASE_PATH}/neutral_face.png`,
  "😕": `${QR_EMOJI_ASSET_BASE_PATH}/confused_face.png`,
  "😌": `${QR_EMOJI_ASSET_BASE_PATH}/relieved_face.png`,
  "😍": `${QR_EMOJI_ASSET_BASE_PATH}/smiling_face_with_heart_eyes.png`,
  "🤔": `${QR_EMOJI_ASSET_BASE_PATH}/thinking_face.png`,
  "🤗": `${QR_EMOJI_ASSET_BASE_PATH}/hugging_face.png`,
  "🤝": `${QR_EMOJI_ASSET_BASE_PATH}/handshake.png`,
  "🤩": `${QR_EMOJI_ASSET_BASE_PATH}/star_struck.png`,
  "🥰": `${QR_EMOJI_ASSET_BASE_PATH}/smiling_face_with_hearts.png`,
  "🥳": `${QR_EMOJI_ASSET_BASE_PATH}/partying_face.png`,
  "🫶": `${QR_EMOJI_ASSET_BASE_PATH}/heart_hands.png`
};

export const getQrEmojiAssetPath = (emoji: string) =>
  QR_EMOJI_ASSET_PATH_BY_EMOJI[emoji] ??
  QR_EMOJI_ASSET_PATH_BY_EMOJI[emoji.replace(/\uFE0F/g, "")] ??
  null;

export const QR_EMOJI_SCENES = {
  poster: [
    {
      emojiIndexes: [2, 3, 4, 6, 9],
      opacity: 0.102,
      rotation: -24,
      size: 0.23,
      x: -0.02,
      y: 0.155
    },
    { emojiIndexes: [2, 4, 6, 7, 9], opacity: 0.094, rotation: 20, size: 0.205, x: 1.02, y: 0.125 },
    { emojiIndexes: [0, 1, 5], opacity: 0.132, rotation: 12, size: 0.115, x: 0.105, y: 0.315 },
    { emojiIndexes: [1, 5, 7, 8], opacity: 0.118, rotation: -14, size: 0.102, x: 0.925, y: 0.38 },
    { emojiIndexes: [2, 3, 6, 9], opacity: 0.096, rotation: -20, size: 0.178, x: 0.0, y: 0.575 },
    { emojiIndexes: [2, 4, 6, 7], opacity: 0.104, rotation: 18, size: 0.15, x: 1.01, y: 0.63 },
    { emojiIndexes: [0, 1, 7, 8], opacity: 0.12, rotation: -15, size: 0.132, x: 0.135, y: 0.81 },
    { emojiIndexes: [3, 5, 7, 8, 9], opacity: 0.108, rotation: 16, size: 0.12, x: 0.84, y: 0.845 },
    { emojiIndexes: [2, 4, 9], opacity: 0.082, rotation: 10, size: 0.082, x: 0.29, y: 0.18 },
    { emojiIndexes: [2, 4, 6, 9], opacity: 0.074, rotation: -11, size: 0.074, x: 0.725, y: 0.205 },
    { emojiIndexes: [2, 5, 9], opacity: 0.084, rotation: 13, size: 0.088, x: 0.255, y: 0.93 },
    { emojiIndexes: [3, 6, 7, 9], opacity: 0.078, rotation: -10, size: 0.082, x: 0.7, y: 0.91 },
    { emojiIndexes: [2, 4, 9], opacity: 0.064, rotation: 17, size: 0.068, x: 0.18, y: 0.48 },
    { emojiIndexes: [2, 6, 9], opacity: 0.06, rotation: -16, size: 0.066, x: 0.82, y: 0.53 },
    { emojiIndexes: [3, 5, 8], opacity: 0.07, rotation: -8, size: 0.072, x: 0.42, y: 0.11 },
    { emojiIndexes: [1, 4, 7], opacity: 0.068, rotation: 9, size: 0.07, x: 0.58, y: 0.955 }
  ],
  stand: [
    { emojiIndexes: [2, 3, 4, 6, 9], opacity: 0.102, rotation: -22, size: 0.21, x: -0.02, y: 0.15 },
    { emojiIndexes: [2, 4, 6, 7, 9], opacity: 0.09, rotation: 18, size: 0.18, x: 1.02, y: 0.13 },
    { emojiIndexes: [0, 1, 5], opacity: 0.128, rotation: 12, size: 0.104, x: 0.09, y: 0.335 },
    { emojiIndexes: [1, 5, 7, 8], opacity: 0.112, rotation: -13, size: 0.096, x: 0.93, y: 0.42 },
    { emojiIndexes: [2, 3, 6, 9], opacity: 0.098, rotation: -18, size: 0.152, x: 0.01, y: 0.66 },
    { emojiIndexes: [2, 4, 6, 7], opacity: 0.098, rotation: 16, size: 0.138, x: 1.0, y: 0.71 },
    { emojiIndexes: [3, 5, 7, 9], opacity: 0.082, rotation: 12, size: 0.084, x: 0.285, y: 0.88 },
    { emojiIndexes: [1, 4, 8, 9], opacity: 0.076, rotation: -11, size: 0.08, x: 0.685, y: 0.865 },
    { emojiIndexes: [2, 4, 9], opacity: 0.068, rotation: 10, size: 0.068, x: 0.27, y: 0.2 },
    { emojiIndexes: [2, 6, 9], opacity: 0.066, rotation: -10, size: 0.066, x: 0.755, y: 0.245 },
    { emojiIndexes: [3, 5, 8], opacity: 0.07, rotation: -7, size: 0.07, x: 0.18, y: 0.525 },
    { emojiIndexes: [1, 4, 7], opacity: 0.066, rotation: 8, size: 0.068, x: 0.84, y: 0.56 }
  ],
  sticker: [
    { emojiIndexes: [2, 3, 4, 9], opacity: 0.135, rotation: -18, size: 0.105, x: 0.052, y: 0.065 },
    { emojiIndexes: [2, 4, 6, 9], opacity: 0.124, rotation: 16, size: 0.1, x: 0.948, y: 0.07 },
    { emojiIndexes: [3, 7, 8, 9], opacity: 0.118, rotation: 13, size: 0.096, x: 0.052, y: 0.93 },
    { emojiIndexes: [1, 4, 7, 9], opacity: 0.12, rotation: -15, size: 0.1, x: 0.948, y: 0.925 },
    { emojiIndexes: [2, 4, 9], opacity: 0.092, rotation: 10, size: 0.076, x: 0.048, y: 0.5 },
    { emojiIndexes: [3, 6, 9], opacity: 0.088, rotation: -11, size: 0.074, x: 0.952, y: 0.5 }
  ],
  table: [
    { emojiIndexes: [2, 3, 4, 6, 9], opacity: 0.1, rotation: -22, size: 0.198, x: -0.02, y: 0.18 },
    { emojiIndexes: [2, 4, 6, 7, 9], opacity: 0.09, rotation: 18, size: 0.17, x: 1.02, y: 0.155 },
    { emojiIndexes: [0, 1, 5], opacity: 0.128, rotation: 12, size: 0.1, x: 0.085, y: 0.42 },
    { emojiIndexes: [1, 5, 7, 8], opacity: 0.114, rotation: -13, size: 0.094, x: 0.93, y: 0.49 },
    { emojiIndexes: [2, 3, 7, 9], opacity: 0.096, rotation: -18, size: 0.128, x: -0.03, y: 0.805 },
    { emojiIndexes: [2, 4, 6, 9], opacity: 0.092, rotation: 16, size: 0.122, x: 1.03, y: 0.83 },
    { emojiIndexes: [3, 5, 9], opacity: 0.078, rotation: 11, size: 0.074, x: 0.18, y: 0.952 },
    { emojiIndexes: [2, 4, 9], opacity: 0.07, rotation: -10, size: 0.066, x: 0.72, y: 0.22 },
    { emojiIndexes: [1, 7, 8], opacity: 0.072, rotation: -8, size: 0.07, x: 0.22, y: 0.62 },
    { emojiIndexes: [3, 6, 9], opacity: 0.068, rotation: 9, size: 0.066, x: 0.78, y: 0.68 },
    { emojiIndexes: [2, 4, 9], opacity: 0.064, rotation: 13, size: 0.062, x: -0.02, y: 0.3 },
    { emojiIndexes: [2, 6, 9], opacity: 0.062, rotation: -12, size: 0.06, x: 1.02, y: 0.315 }
  ]
} as const satisfies Record<QrFormatId, readonly QrEmojiMark[]>;

const rectsOverlap = (
  first: { bottom: number; left: number; right: number; top: number },
  second: { bottom: number; left: number; right: number; top: number }
) =>
  first.right > second.left &&
  first.left < second.right &&
  first.bottom > second.top &&
  first.top < second.bottom;

export const getQrEmojiScene = (
  formatId: QrFormatId,
  layout?: QrFormatLayout,
  content: QrEmojiSceneContent = {}
) => {
  const marks = QR_EMOJI_SCENES[formatId];

  if (!layout) {
    return marks;
  }

  const margin = layout.compact ? 2 : 7;
  const primaryTextInset = layout.compact ? layout.padding : layout.pageWidth * 0.18;
  const captionTextInset = layout.compact ? layout.padding : layout.pageWidth * 0.1;
  const noGoZones = [
    {
      bottom: layout.qrY + layout.qrSize + layout.qrSafePadding + margin,
      left: layout.qrX - layout.qrSafePadding - margin,
      right: layout.qrX + layout.qrSize + layout.qrSafePadding + margin,
      top: layout.qrY - layout.qrSafePadding - margin
    },
    {
      bottom: layout.footerY + layout.footerLogoHeight + margin,
      left: (layout.pageWidth - layout.footerLogoWidth) / 2 - margin,
      right: (layout.pageWidth + layout.footerLogoWidth) / 2 + margin,
      top: layout.footerY - margin
    }
  ];

  if (!layout.compact) {
    noGoZones.push({
      bottom: layout.logoY + layout.logoSize + margin,
      left: (layout.pageWidth - layout.logoSize) / 2 - margin,
      right: (layout.pageWidth + layout.logoSize) / 2 + margin,
      top: layout.logoY - margin
    });
  }

  if (content.hasHeadline) {
    noGoZones.push({
      bottom: layout.headlineY + layout.headlineHeight + margin,
      left: primaryTextInset - margin,
      right: layout.pageWidth - primaryTextInset + margin,
      top: layout.headlineY - margin
    });
  }

  if (content.hasContext) {
    noGoZones.push({
      bottom: layout.contextY + layout.contextHeight + margin,
      left: primaryTextInset - margin,
      right: layout.pageWidth - primaryTextInset + margin,
      top: layout.contextY - margin
    });
  }

  if (content.hasCaption) {
    noGoZones.push({
      bottom: layout.captionY + layout.captionHeight + margin,
      left: captionTextInset - margin,
      right: layout.pageWidth - captionTextInset + margin,
      top: layout.captionY - margin
    });
  }

  return marks.filter((mark) => {
    const size = Math.min(layout.pageWidth, layout.pageHeight) * mark.size;
    const centerX = layout.pageWidth * mark.x;
    const centerY = layout.pageHeight * mark.y;
    const bounds = {
      bottom: centerY + size / 2,
      left: centerX - size / 2,
      right: centerX + size / 2,
      top: centerY - size / 2
    };

    return !noGoZones.some((zone) => rectsOverlap(bounds, zone));
  });
};

const getQrStableIndex = (value: string, length: number) => {
  if (length <= 1) return 0;

  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % length;
};

export const getQrEmojiForMark = ({
  emojiTheme,
  formatId,
  index,
  mark,
  seed
}: {
  emojiTheme: QrEmojiTheme;
  formatId: QrFormatId;
  index: number;
  mark: QrEmojiMark;
  seed: string;
}) => {
  if (!emojiTheme.emojis.length) {
    return "";
  }

  if (typeof mark.emojiIndex === "number") {
    return emojiTheme.emojis[mark.emojiIndex % emojiTheme.emojis.length];
  }

  const pool = mark.emojiIndexes;
  const emojiIndex =
    pool && pool.length > 0
      ? pool[getQrStableIndex(`${seed}:${formatId}:${index}:${mark.x}:${mark.y}`, pool.length)]
      : getQrStableIndex(`${seed}:${formatId}:${index}`, emojiTheme.emojis.length);

  return emojiTheme.emojis[emojiIndex % emojiTheme.emojis.length];
};

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
  emojiOpacity: QR_EMOJI_OPACITY_DEFAULT,
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
  const contextBeforeQrSizeReduction = loosenContextBeforeQr ? (formatId === "table" ? 16 : 8) : 0;
  const contextBeforeQrOffset = loosenContextBeforeQr ? (formatId === "table" ? 18 : 10) : 0;
  const qrSize = baseQrSize - contextBeforeQrSizeReduction;
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
  const qrY = baseQrY + contextBeforeQrOffset;
  const captionFontSize = formatId === "poster" ? 17 : 13;
  const captionLineHeight = formatId === "poster" ? 23 : 18;
  const captionHeight = formatId === "poster" ? 92 : 60;
  const captionGap = formatId === "poster" ? 24 : 14;
  const captionFontWeight = 500;
  const logoSize = compact ? 34 : formatId === "poster" ? 66 : 52;
  const logoY = compact ? 0 : formatId === "poster" ? 30 : 22;
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

export const normalizeQrEmojiOpacity = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return QR_EMOJI_OPACITY_DEFAULT;
  }

  return Math.min(QR_EMOJI_OPACITY_MAX, Math.max(QR_EMOJI_OPACITY_MIN, value));
};

export const getQrEmojiOpacityPreset = (value: number) =>
  QR_EMOJI_OPACITY_PRESETS.reduce((closest, preset) =>
    Math.abs(preset.opacity - value) < Math.abs(closest.opacity - value) ? preset : closest
  );

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
