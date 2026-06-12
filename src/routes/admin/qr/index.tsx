import * as React from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import QRCode from "qrcode";

import { Button, Input, List, PendingScreen, Textarea, Toggle } from "~/common/ui";
import { cn } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import { useAdminOrganization } from "~/shared/admin";
import { IZOH_WORDMARK_PATHS, IZOH_WORDMARK_WIDTH } from "~/shared/brand";
import { useI18n } from "~/shared/i18n/react";
import { queryKeys } from "~/shared/query";
import { PageTransition } from "~/shared/router/page-transition";
import {
  QR_DEFAULT_DRAFT,
  QR_CONTEXT_MAX_LENGTH,
  QR_DRAFT_STORAGE_KEY,
  QR_EMOJI_THEMES,
  QR_EMOJI_THEME_BY_ID,
  QR_FORMATS,
  QR_FORMAT_BY_ID,
  createQrPdfFileName,
  getQrAlignmentPatternCenters,
  getQrEmojiScene,
  getQrErrorCorrectionLevel,
  getQrFormatLayout,
  getQrFormatVisualStyle,
  getQrPalette,
  isQrAlignmentModule,
  isQrEmojiThemeId,
  isQrFinderModule,
  isQrFormatId,
  isQrVisualStyle,
  normalizeQrHexColor,
  normalizeQrText,
  type QrCustomColors,
  type QrErrorCorrectionLevel,
  type QrEmojiThemeId,
  type QrFormatId,
  type QrPalette,
  type QrTemplateDraft,
  type QrVisualStyle
} from "~/shared/qr";
import {
  tmaHaptics,
  useTma,
  useTmaBackButton,
  useTmaMainButton,
  useTmaSecondaryButton
} from "~/shared/tma";

const createQr = (value: string, errorCorrectionLevel: QrErrorCorrectionLevel) =>
  QRCode.create(value, {
    errorCorrectionLevel
  });

const createDefaultDraft = (t: (key: string) => string): QrTemplateDraft => ({
  ...QR_DEFAULT_DRAFT,
  caption: t("qr.constructor.text.defaultCaption"),
  headline: t("qr.constructor.text.defaultHeadline")
});

const QR_CAPTION_MAX_LENGTH = Math.max(...QR_FORMATS.map((format) => format.captionMaxLength));
const QR_HEADLINE_MAX_LENGTH = Math.max(...QR_FORMATS.map((format) => format.headlineMaxLength));

const readDraft = (
  t: (key: string) => string,
  storageKey = QR_DRAFT_STORAGE_KEY
): QrTemplateDraft => {
  const defaultDraft = createDefaultDraft(t);

  if (typeof window === "undefined") {
    return defaultDraft;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return defaultDraft;
    }

    const draft = JSON.parse(raw) as Partial<QrTemplateDraft>;

    return {
      caption: normalizeQrText(draft.caption, QR_CAPTION_MAX_LENGTH),
      customColors: {
        background: normalizeQrHexColor(
          draft.customColors?.background,
          QR_DEFAULT_DRAFT.customColors.background
        ),
        paper: normalizeQrHexColor(draft.customColors?.paper, QR_DEFAULT_DRAFT.customColors.paper),
        text: normalizeQrHexColor(draft.customColors?.text, QR_DEFAULT_DRAFT.customColors.text)
      },
      emojiThemeId: isQrEmojiThemeId(draft.emojiThemeId)
        ? draft.emojiThemeId
        : QR_DEFAULT_DRAFT.emojiThemeId,
      formatId: isQrFormatId(draft.formatId) ? draft.formatId : QR_DEFAULT_DRAFT.formatId,
      headline: normalizeQrText(draft.headline, QR_HEADLINE_MAX_LENGTH),
      qrContext: normalizeQrText(draft.qrContext, QR_CONTEXT_MAX_LENGTH),
      qrStyle: isQrVisualStyle(draft.qrStyle) ? draft.qrStyle : QR_DEFAULT_DRAFT.qrStyle,
      showContext:
        typeof draft.showContext === "boolean" ? draft.showContext : QR_DEFAULT_DRAFT.showContext
    };
  } catch {
    return defaultDraft;
  }
};

const copyTextToClipboard = async (text: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback for older Telegram WebViews.
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
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

const QrMatrixSvg = ({
  background,
  errorCorrectionLevel,
  foreground,
  value
}: {
  background: string;
  errorCorrectionLevel: QrErrorCorrectionLevel;
  foreground: string;
  value: string;
  style: QrVisualStyle;
}) => {
  const qr = React.useMemo(() => createQr(value, errorCorrectionLevel), [
    errorCorrectionLevel,
    value
  ]);
  const quietZone = 4;
  const moduleCount = qr.modules.size;
  const size = moduleCount + quietZone * 2;
  const alignmentCenters = React.useMemo(
    () => getQrAlignmentPatternCenters(moduleCount),
    [moduleCount]
  );
  const modules: React.ReactNode[] = [];
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

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!isDarkDataModule(row, col)) continue;

      const x = col + quietZone;
      const y = row + quietZone;
      const key = `${row}:${col}`;
      const hasTop = isDarkDataModule(row - 1, col);
      const hasRight = isDarkDataModule(row, col + 1);
      const hasBottom = isDarkDataModule(row + 1, col);
      const hasLeft = isDarkDataModule(row, col - 1);

      modules.push(
        <path
          key={key}
          d={createRoundedModulePath(x, y, 1, 0.42, {
            bottomLeft: !hasBottom && !hasLeft,
            bottomRight: !hasBottom && !hasRight,
            topLeft: !hasTop && !hasLeft,
            topRight: !hasTop && !hasRight
          })}
          fill={foreground}
        />
      );
    }
  }
  const finderPatterns = [
    { key: "top-left", x: quietZone, y: quietZone },
    { key: "top-right", x: quietZone + moduleCount - 7, y: quietZone },
    { key: "bottom-left", x: quietZone, y: quietZone + moduleCount - 7 }
  ];
  const alignmentPatterns = alignmentCenters.flatMap((centerRow) =>
    alignmentCenters.flatMap((centerCol) => {
      if (
        (centerRow === 6 && centerCol === 6) ||
        (centerRow === 6 && centerCol === moduleCount - 7) ||
        (centerRow === moduleCount - 7 && centerCol === 6)
      ) {
        return [];
      }

      return [
        {
          key: `${centerRow}:${centerCol}`,
          x: quietZone + centerCol - 2,
          y: quietZone + centerRow - 2
        }
      ];
    })
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      className="h-full w-full"
      shapeRendering="geometricPrecision"
    >
      <rect fill={background} height={size} width={size} />
      {modules}
      {alignmentPatterns.map((pattern) => (
        <g key={pattern.key}>
          <rect fill={foreground} height={5} rx={1.35} width={5} x={pattern.x} y={pattern.y} />
          <rect
            fill={background}
            height={3}
            rx={0.84}
            width={3}
            x={pattern.x + 1}
            y={pattern.y + 1}
          />
          <rect
            fill={foreground}
            height={1}
            rx={0.28}
            width={1}
            x={pattern.x + 2}
            y={pattern.y + 2}
          />
        </g>
      ))}
      {finderPatterns.map((pattern) => (
        <g key={pattern.key}>
          <rect fill={foreground} height={7} rx={2.2} width={7} x={pattern.x} y={pattern.y} />
          <rect
            fill={background}
            height={5}
            rx={1.65}
            width={5}
            x={pattern.x + 1}
            y={pattern.y + 1}
          />
          <rect
            fill={foreground}
            height={3}
            rx={0.86}
            width={3}
            x={pattern.x + 2}
            y={pattern.y + 2}
          />
        </g>
      ))}
    </svg>
  );
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="ios-caption-1 px-1 font-semibold uppercase text-muted">{children}</h2>
);

const PillPicker = <T extends string>({
  getLabel,
  items,
  onChange,
  value
}: {
  getLabel: (item: T) => string;
  items: readonly T[];
  onChange: (value: T) => void;
  value: T;
}) => (
  <div className="scrollbar-hide flex gap-1 overflow-x-auto py-1">
    {items.map((item) => {
      const active = item === value;

      return (
        <button
          key={item}
          type="button"
          onClick={() => {
            if (!active) {
              tmaHaptics.selection();
            }

            onChange(item);
          }}
          className={cn(
            "ios-touch-target ios-footnote relative shrink-0 rounded-full px-3.5 font-medium transition-colors",
            active
              ? "bg-surface-2 text-foreground shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-border/70 dark:bg-surface-3 dark:ring-white/10"
              : "bg-foreground/[0.045] text-muted active:bg-foreground/[0.07] active:text-foreground dark:bg-white/[0.055] dark:active:bg-white/[0.08]"
          )}
        >
          {getLabel(item)}
        </button>
      );
    })}
  </div>
);

const ColorControl = ({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <label className="ios-touch-target grid min-w-0 cursor-pointer justify-items-center gap-1.5 rounded-[18px] bg-foreground/[0.045] px-2 py-2 text-muted transition-colors active:bg-foreground/[0.07] dark:bg-white/[0.055]">
    <span
      className="size-7 shrink-0 rounded-full ring-2 ring-surface"
      style={{
        background: value
      }}
    />
    <span className="ios-caption-2 min-w-0 text-center font-medium leading-tight">{label}</span>
    <input
      aria-label={label}
      className="sr-only"
      type="color"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const EmojiThemePicker = ({
  emojiThemeId,
  onChange,
  t
}: {
  emojiThemeId: QrEmojiThemeId;
  onChange: (value: QrEmojiThemeId) => void;
  t: (key: string) => string;
}) => (
  <div className="scrollbar-hide -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1.5 sm:-mx-6 sm:scroll-px-6 sm:px-6">
    {QR_EMOJI_THEMES.map((theme) => {
      const active = theme.id === emojiThemeId;

      return (
        <button
          key={theme.id}
          type="button"
          className={cn(
            "grid min-w-[82px] shrink-0 snap-start justify-items-center gap-1 rounded-[22px] px-3.5 py-2.5 transition-colors",
            active
              ? "bg-surface-2 shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-border/70 dark:bg-surface-3"
              : "bg-foreground/[0.045] active:bg-foreground/[0.07] dark:bg-white/[0.055]"
          )}
          onClick={() => {
            if (!active) {
              tmaHaptics.selection();
            }

            onChange(theme.id);
          }}
        >
          <span className="text-[28px] leading-none">{theme.previewEmoji}</span>
          <span className="ios-caption-2 font-medium text-muted">
            {t(`qr.constructor.emoji.themes.${theme.id}`)}
          </span>
        </button>
      );
    })}
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="ios-caption-1 px-1 font-medium text-muted">{children}</p>
);

const PreviewLogo = ({
  clipId,
  logoUrl,
  name,
  palette,
  padding = 0,
  paddingColor,
  size,
  x,
  y
}: {
  clipId: string;
  logoUrl?: null | string;
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

  return (
    <g>
      {padding > 0 ? (
        <circle
          cx={centerX}
          cy={centerY}
          fill={paddingColor ?? palette.paper}
          r={radius + padding}
        />
      ) : null}
      {logoUrl ? (
        <defs>
          <clipPath id={clipId}>
            <circle cx={centerX} cy={centerY} r={radius} />
          </clipPath>
        </defs>
      ) : null}
      <circle cx={centerX} cy={centerY} fill={palette.text} r={radius} />
      {logoUrl ? (
        <image
          clipPath={`url(#${clipId})`}
          height={size}
          href={logoUrl}
          preserveAspectRatio="xMidYMid slice"
          width={size}
          x={x}
          y={y}
        />
      ) : (
        <text
          dominantBaseline="middle"
          fill={palette.paper}
          fontFamily="var(--font-ui)"
          fontSize={size * 0.46}
          fontWeight={700}
          textAnchor="middle"
          x={centerX}
          y={centerY + size * 0.03}
        >
          {(name.trim().slice(0, 1).toUpperCase() || "I").slice(0, 1)}
        </text>
      )}
    </g>
  );
};

const PreviewWordmark = ({
  color,
  opacity = 0.52,
  width,
  x,
  y
}: {
  color: string;
  opacity?: number;
  width: number;
  x: number;
  y: number;
}) => {
  const scale = width / IZOH_WORDMARK_WIDTH;

  return (
    <g opacity={opacity} transform={`translate(${x} ${y}) scale(${scale})`}>
      {IZOH_WORDMARK_PATHS.map((path) => (
        <path key={path} d={path} fill={color} />
      ))}
    </g>
  );
};

const PreviewText = ({
  children,
  color,
  fontSize,
  fontWeight,
  height,
  lineHeight,
  wrap = false,
  width,
  x,
  y
}: {
  children: React.ReactNode;
  color: string;
  fontSize: number;
  fontWeight: number;
  height: number;
  lineHeight: number;
  wrap?: boolean;
  width: number;
  x: number;
  y: number;
}) => (
  <foreignObject height={height} width={width} x={x} y={y}>
    <div
      style={{
        color,
        fontFamily: "var(--font-ui)",
        fontSize,
        fontWeight,
        height: "100%",
        lineHeight: `${lineHeight}px`,
        overflow: "hidden",
        textAlign: "center",
        textOverflow: "ellipsis",
        textWrap: wrap ? "balance" : "nowrap",
        whiteSpace: wrap ? "normal" : "nowrap",
        width: "100%"
      }}
    >
      {children}
    </div>
  </foreignObject>
);

const QrPosterPreview = ({
  caption,
  context,
  formatId,
  headline,
  organizationLogoUrl,
  organizationName,
  palette,
  qrStyle,
  emojiThemeId,
  url,
  t
}: {
  caption: string;
  context: string;
  formatId: QrFormatId;
  headline: string;
  organizationLogoUrl?: null | string;
  organizationName: string;
  palette: QrPalette;
  qrStyle: QrVisualStyle;
  emojiThemeId: QrEmojiThemeId;
  url: null | string;
  t: (key: string) => string;
}) => {
  const logoClipId = `qr-logo-${React.useId().replace(/:/g, "")}`;
  const format = QR_FORMAT_BY_ID[formatId];
  const title = format.compact ? "" : format.allowCustomHeadline ? headline : organizationName;
  const printableContext = format.allowContext ? context : "";
  const layout = getQrFormatLayout(formatId, {
    hasCaption: Boolean(caption),
    hasContext: Boolean(printableContext),
    hasHeadline: Boolean(title)
  });
  const compact = layout.compact;
  const showEmoji = format.allowEmoji && emojiThemeId !== "none";
  const surfaceColor = palette.background;
  const textColor = palette.text;
  const mutedColor = palette.muted;
  const emojiMarks = getQrEmojiScene(formatId);
  const emojiTheme = QR_EMOJI_THEME_BY_ID[emojiThemeId];
  const errorCorrectionLevel = getQrErrorCorrectionLevel(formatId);
  const compactLogoPadding = Math.max(3, layout.logoSize * 0.16);

  return (
    <section className="grid justify-items-center gap-2">
      <div className={cn("w-full", format.previewWidthClassName)}>
        <svg
          aria-label={t("qr.constructor.preview")}
          className="block h-auto w-full overflow-hidden rounded-[22px] shadow-[0_18px_44px_rgba(15,23,42,0.12)] ring-1 ring-foreground/[0.06]"
          role="img"
          style={{
            aspectRatio: format.aspectRatio,
            fontFamily: "var(--font-ui)"
          }}
          viewBox={`0 0 ${layout.pageWidth} ${layout.pageHeight}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect fill={surfaceColor} height={layout.pageHeight} width={layout.pageWidth} />

          {showEmoji
            ? emojiMarks.map((mark, index) => {
                const size = Math.min(layout.pageWidth, layout.pageHeight) * mark.size;
                const x = layout.pageWidth * mark.x;
                const y = layout.pageHeight * mark.y;

                return (
                  <text
                    key={`${emojiThemeId}-${formatId}-${index}`}
                    dominantBaseline="middle"
                    fontFamily="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
                    fontSize={size}
                    opacity={mark.opacity}
                    textAnchor="middle"
                    transform={`rotate(${mark.rotation} ${x} ${y})`}
                    x={x}
                    y={y}
                  >
                    {emojiTheme.emojis[index % emojiTheme.emojis.length]}
                  </text>
                );
              })
            : null}

          {!compact ? (
            <PreviewLogo
              clipId={`${logoClipId}-top`}
              logoUrl={organizationLogoUrl}
              name={organizationName}
              palette={palette}
              size={layout.logoSize}
              x={(layout.pageWidth - layout.logoSize) / 2}
              y={layout.logoY}
            />
          ) : null}

          {title ? (
            <PreviewText
              color={textColor}
              fontSize={layout.headlineFontSize}
              fontWeight={700}
              height={layout.headlineHeight}
              lineHeight={layout.headlineHeight}
              width={layout.pageWidth}
              x={0}
              y={layout.headlineY}
            >
              {title}
            </PreviewText>
          ) : null}

          {printableContext ? (
            <PreviewText
              color={mutedColor}
              fontSize={layout.contextFontSize}
              fontWeight={600}
              height={layout.contextHeight}
              lineHeight={layout.contextHeight}
              width={layout.pageWidth}
              x={0}
              y={layout.contextY}
            >
              {printableContext}
            </PreviewText>
          ) : null}

          <rect
            fill={palette.paper}
            height={layout.qrSize + layout.qrSafePadding * 2}
            rx={layout.qrRadius}
            width={layout.qrSize + layout.qrSafePadding * 2}
            x={layout.qrX - layout.qrSafePadding}
            y={layout.qrY - layout.qrSafePadding}
          />

          {url ? (
            <foreignObject
              height={layout.qrSize}
              width={layout.qrSize}
              x={layout.qrX}
              y={layout.qrY}
            >
              <div style={{ height: "100%", width: "100%" }}>
                <QrMatrixSvg
                  background={palette.paper}
                  errorCorrectionLevel={errorCorrectionLevel}
                  foreground={palette.foreground}
                  style={qrStyle}
                  value={url}
                />
              </div>
            </foreignObject>
          ) : null}

          {compact ? (
            <PreviewLogo
              clipId={`${logoClipId}-center`}
              logoUrl={organizationLogoUrl}
              name={organizationName}
              padding={compactLogoPadding}
              paddingColor={palette.paper}
              palette={palette}
              size={layout.logoSize}
              x={(layout.pageWidth - layout.logoSize) / 2}
              y={layout.qrY + layout.qrSize / 2 - layout.logoSize / 2}
            />
          ) : format.allowCaption && caption ? (
            <PreviewText
              color={mutedColor}
              fontSize={layout.captionFontSize}
              fontWeight={layout.captionFontWeight}
              height={layout.captionHeight}
              lineHeight={layout.captionLineHeight}
              wrap
              width={layout.pageWidth - layout.padding * 2}
              x={layout.padding}
              y={layout.captionY}
            >
              {caption}
            </PreviewText>
          ) : null}

          {layout.footerLogoWidth > 0 ? (
            <PreviewWordmark
              color={palette.muted}
              opacity={compact ? 0.44 : undefined}
              width={layout.footerLogoWidth}
              x={(layout.pageWidth - layout.footerLogoWidth) / 2}
              y={layout.footerY}
            />
          ) : null}
        </svg>
      </div>
    </section>
  );
};

export const AdminQrConstructor = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/admin/$organizationId/qr" });
  const tma = useTma();
  const { t } = useI18n();
  const {
    isLoading: isOrganizationsLoading,
    organizations,
    setActiveOrganizationId
  } = useAdminOrganization();
  const organization =
    organizations.find((item) => item.id === params.organizationId) ??
    organizations.find((item) => item.slug === params.organizationId) ??
    null;
  const organizationName = organization?.name ?? t("common.brand");
  const qrDraftStorageKey = organization
    ? `${QR_DRAFT_STORAGE_KEY}.${organization.id}`
    : QR_DRAFT_STORAGE_KEY;
  const initialDraft = React.useMemo(() => readDraft(t, qrDraftStorageKey), [qrDraftStorageKey, t]);
  const [formatId, setFormatId] = React.useState<QrFormatId>(initialDraft.formatId);
  const [qrStyle, setQrStyle] = React.useState<QrVisualStyle>(initialDraft.qrStyle);
  const [emojiThemeId, setEmojiThemeId] = React.useState<QrEmojiThemeId>(initialDraft.emojiThemeId);
  const [qrContext, setQrContext] = React.useState(initialDraft.qrContext);
  const [headline, setHeadline] = React.useState(initialDraft.headline);
  const [caption, setCaption] = React.useState(initialDraft.caption);
  const [customColors, setCustomColors] = React.useState<QrCustomColors>(initialDraft.customColors);
  const [showContext, setShowContext] = React.useState(initialDraft.showContext);
  const [isPdfActionPending, setIsPdfActionPending] = React.useState(false);

  const currentFormat = QR_FORMAT_BY_ID[formatId];
  const activeQrStyle = getQrFormatVisualStyle(formatId, qrStyle);
  const palette = getQrPalette(customColors);
  const cleanQrContext = normalizeQrText(qrContext, QR_CONTEXT_MAX_LENGTH);
  const printableQrContext =
    currentFormat.allowContext && showContext
      ? normalizeQrText(cleanQrContext, currentFormat.contextMaxLength)
      : "";
  const cleanHeadline = currentFormat.allowCustomHeadline
    ? normalizeQrText(headline, currentFormat.headlineMaxLength)
    : "";
  const cleanCaption = currentFormat.allowCaption
    ? normalizeQrText(caption, currentFormat.captionMaxLength)
    : "";
  const showTextSettings = currentFormat.allowCustomHeadline || currentFormat.allowCaption;
  const showQrStylePicker = currentFormat.qrStyles.length > 1;
  const deferredQrContext = React.useDeferredValue(cleanQrContext);
  const qrLinkQuery = useQuery({
    enabled: Boolean(organization) && tma.isReady,
    queryFn: () => {
      const contextQuery = deferredQrContext
        ? `?context=${encodeURIComponent(deferredQrContext)}`
        : "";

      return fetchApiJson<{ url?: string }>(
        `/api/organizations/${organization!.id}/qr-link${contextQuery}`,
        {
          initDataRaw: tma.initDataRaw
        }
      );
    },
    queryKey: organization
      ? queryKeys.organizationQrLink(organization.id, deferredQrContext, tma.initDataRaw)
      : ["organization", "qr-link", "idle"]
  });
  const qrTargetUrl = qrLinkQuery.data?.url ?? null;
  const backToOrganization = React.useCallback(() => {
    void navigate({
      params: { organizationId: params.organizationId },
      to: "/admin/$organizationId"
    });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, backToOrganization);

  React.useEffect(() => {
    if (organization) {
      setActiveOrganizationId(organization.id);
    }
  }, [organization, setActiveOrganizationId]);

  React.useLayoutEffect(() => {
    const draft = readDraft(t, qrDraftStorageKey);

    setFormatId(draft.formatId);
    setQrContext(draft.qrContext);
    setQrStyle(draft.qrStyle);
    setEmojiThemeId(draft.emojiThemeId);
    setHeadline(draft.headline);
    setCaption(draft.caption);
    setCustomColors(draft.customColors);
    setShowContext(draft.showContext);
  }, [qrDraftStorageKey, t]);

  React.useEffect(() => {
    const nextQrStyle = getQrFormatVisualStyle(formatId, qrStyle);

    if (nextQrStyle !== qrStyle) {
      setQrStyle(nextQrStyle);
    }
  }, [formatId, qrStyle]);

  React.useEffect(() => {
    if (!organization || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      qrDraftStorageKey,
      JSON.stringify({
        caption: cleanCaption,
        customColors,
        emojiThemeId,
        formatId,
        headline: cleanHeadline,
        qrContext: cleanQrContext,
        qrStyle: activeQrStyle,
        showContext
      } satisfies QrTemplateDraft)
    );
  }, [
    activeQrStyle,
    cleanCaption,
    cleanHeadline,
    cleanQrContext,
    customColors,
    emojiThemeId,
    formatId,
    organization,
    qrDraftStorageKey,
    showContext
  ]);

  const updateCustomColor = (key: keyof QrCustomColors, value: string) => {
    setCustomColors((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handlePdfAction = React.useCallback(async () => {
    if (!organization || isPdfActionPending) {
      return;
    }

    setIsPdfActionPending(true);

    try {
      const deliveryQuery = tma.isTelegram ? "?delivery=chat" : "";
      const response = await fetch(`/api/organizations/${organization.id}/qr-pdf${deliveryQuery}`, {
        body: JSON.stringify({
          caption: cleanCaption,
          context: cleanQrContext,
          customColors,
          emojiThemeId,
          formatId,
          headline: cleanHeadline,
          qrStyle: activeQrStyle,
          showContext
        }),
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Init-Data": tma.initDataRaw
        },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("QR PDF action failed.");
      }

      if (!tma.isTelegram) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = createQrPdfFileName({
          context: cleanQrContext,
          organizationName: organization.name,
          organizationSlug: organization.slug
        });
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
      }

      tmaHaptics.notification("success");
    } catch {
      tmaHaptics.notification("error");
    } finally {
      setIsPdfActionPending(false);
    }
  }, [
    cleanCaption,
    cleanHeadline,
    cleanQrContext,
    customColors,
    emojiThemeId,
    formatId,
    isPdfActionPending,
    organization,
    showContext,
    activeQrStyle,
    tma.isTelegram,
    tma.initDataRaw
  ]);

  const handleCopyQrLink = React.useCallback(async () => {
    if (!qrTargetUrl) {
      return;
    }

    const copied = await copyTextToClipboard(qrTargetUrl);

    tmaHaptics.notification(copied ? "success" : "error");
  }, [qrTargetUrl]);

  useTmaMainButton(
    organization
      ? {
          enabled: Boolean(qrTargetUrl) && !isPdfActionPending,
          loading: isPdfActionPending,
          shine: Boolean(qrTargetUrl),
          text: t("qr.constructor.sendPdfToChat"),
          visible: true
        }
      : null,
    handlePdfAction
  );

  useTmaSecondaryButton(
    organization
      ? {
          enabled: Boolean(qrTargetUrl),
          position: "top",
          text: t("qr.constructor.copyLink"),
          visible: true
        }
      : null,
    handleCopyQrLink
  );

  if (isOrganizationsLoading && !organization) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  if (!organization) {
    return (
      <PageTransition>
        <main className="tma-page bg-surface text-foreground">
          <div className="account-shell">
            <section className="grid justify-items-center gap-2 px-4 text-center">
              <h2 className="ios-title-2 font-semibold tracking-normal text-foreground">
                {t("admin.organizations.emptyTitle")}
              </h2>
              <p className="ios-footnote max-w-[360px] text-muted">
                {t("admin.organizations.emptyHint")}
              </p>
            </section>
          </div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="mx-auto grid w-full max-w-[620px] gap-7 px-4 pt-7 pb-8 sm:px-6 lg:pt-9">
          <section className="grid gap-1 px-1">
            <h1 className="ios-title-1 font-semibold tracking-normal text-foreground">
              {t("qr.constructor.title")}
            </h1>
            <p className="ios-footnote text-muted">{t("qr.constructor.subtitle")}</p>
          </section>

          <QrPosterPreview
            caption={cleanCaption}
            context={printableQrContext}
            emojiThemeId={emojiThemeId}
            formatId={formatId}
            headline={cleanHeadline}
            organizationLogoUrl={organization.logoUrl}
            organizationName={organizationName}
            palette={palette}
            qrStyle={activeQrStyle}
            t={t}
            url={qrTargetUrl}
          />

          <section className="grid gap-2.5">
            <SectionTitle>{t("qr.constructor.formats.title")}</SectionTitle>
            <PillPicker
              items={QR_FORMATS.map((item) => item.id)}
              value={formatId}
              onChange={setFormatId}
              getLabel={(item) => t(`qr.constructor.formats.${item}.name`)}
            />
            <p className="ios-subhead px-1 font-medium leading-relaxed text-muted">
              {t(`qr.constructor.formats.${formatId}.description`)}{" "}
              {t("qr.constructor.formats.sizeHint", {
                size: t(`qr.constructor.formats.${formatId}.size`)
              })}
            </p>
          </section>

          <section className="grid gap-4">
            <SectionTitle>{t("qr.constructor.styles.title")}</SectionTitle>
            <div className="grid gap-3">
              {showQrStylePicker ? (
                <div className="grid gap-1">
                  <FieldLabel>{t("qr.constructor.qrStyle.title")}</FieldLabel>
                  <PillPicker
                    items={currentFormat.qrStyles}
                    value={activeQrStyle}
                    onChange={setQrStyle}
                    getLabel={(item) => t(`qr.constructor.qrStyle.${item}`)}
                  />
                </div>
              ) : null}
              {currentFormat.allowEmoji ? (
                <div className="grid gap-1">
                  <FieldLabel>{t("qr.constructor.emoji.title")}</FieldLabel>
                  <EmojiThemePicker emojiThemeId={emojiThemeId} t={t} onChange={setEmojiThemeId} />
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-2">
            <SectionTitle>{t("qr.constructor.colors.title")}</SectionTitle>
            <div className="grid gap-2 pt-1 min-[380px]:grid-cols-3">
              <ColorControl
                label={t("qr.constructor.colors.background")}
                value={customColors.background}
                onChange={(value) => updateCustomColor("background", value)}
              />
              <ColorControl
                label={t("qr.constructor.colors.paper")}
                value={customColors.paper}
                onChange={(value) => updateCustomColor("paper", value)}
              />
              <ColorControl
                label={t("qr.constructor.colors.text")}
                value={customColors.text}
                onChange={(value) => updateCustomColor("text", value)}
              />
            </div>
          </section>

          {showTextSettings ? (
            <section className="grid gap-3">
              <SectionTitle>{t("qr.constructor.text.title")}</SectionTitle>
              {currentFormat.allowCustomHeadline ? (
                <Input
                  clearLabel={t("common.actions.clear")}
                  maxLength={currentFormat.headlineMaxLength}
                  placeholder={t("qr.constructor.text.headlinePlaceholder")}
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                />
              ) : null}
              {currentFormat.allowCaption ? (
                <Textarea
                  autoresize={{ maxHeight: 132 }}
                  maxLength={currentFormat.captionMaxLength}
                  placeholder={t("qr.constructor.text.captionPlaceholder")}
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                />
              ) : null}
            </section>
          ) : null}

          <section className="grid gap-2">
            <SectionTitle>{t("qr.constructor.context.title")}</SectionTitle>
            <Input
              clearLabel={t("common.actions.clear")}
              maxLength={QR_CONTEXT_MAX_LENGTH}
              placeholder={t("qr.constructor.context.placeholder")}
              value={qrContext}
              onChange={(event) => setQrContext(event.target.value)}
            />
            {currentFormat.allowContext ? (
              <List
                className="rounded-[18px]"
                items={[
                  {
                    addon: {
                      after: (
                        <Toggle
                          aria-label={t("qr.constructor.context.showInLayout")}
                          checked={showContext}
                          onCheckedChange={setShowContext}
                        />
                      )
                    },
                    isAction: false,
                    title: t("qr.constructor.context.showInLayout")
                  }
                ]}
                spacing="xs"
              />
            ) : null}
            <p className="ios-footnote px-1 text-muted">{t("qr.constructor.context.hint")}</p>
          </section>

          {!tma.isTelegram ? (
            <Button
              disabled={!qrTargetUrl || isPdfActionPending}
              state={isPdfActionPending ? "loading" : "idle"}
              type="button"
              variant="primary"
              wide
              onClick={handlePdfAction}
            >
              <Download size={17} strokeWidth={2.35} />
              {t("qr.constructor.downloadPdf")}
            </Button>
          ) : null}
        </div>
      </main>
    </PageTransition>
  );
};
