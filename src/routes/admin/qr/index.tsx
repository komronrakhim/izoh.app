import * as React from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import QRCode from "qrcode";

import { Button, Input, PendingScreen } from "~/common/ui";
import { cn } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import { useAdminOrganization } from "~/shared/admin";
import { useI18n } from "~/shared/i18n/react";
import { queryKeys } from "~/shared/query";
import { PageTransition } from "~/shared/router/page-transition";
import { tmaHaptics, useTma, useTmaBackButton } from "~/shared/tma";

type QrPaletteId = "brand" | "graphite" | "mint";
type QrVisualStyle = "dots" | "rounded" | "square";
type QrFormatId = "a6" | "sticker" | "table" | "tent";
type QrCopyPresetId = "complaint" | "review" | "staff";

type QrPalette = {
  id: QrPaletteId;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  paper: string;
  text: string;
};

type QrFormat = {
  compact: boolean;
  id: QrFormatId;
  aspectRatio: string;
  previewWidthClassName: string;
  qrSizeClassName: string;
};

const QR_DRAFT_STORAGE_KEY = "izoh.admin.qrConstructorDraft";

const palettes: QrPalette[] = [
  {
    id: "brand",
    accent: "#2563eb",
    background: "#eef4ff",
    foreground: "#111827",
    muted: "#64748b",
    paper: "#ffffff",
    text: "#0f172a"
  },
  {
    id: "graphite",
    accent: "#52525b",
    background: "#f4f4f5",
    foreground: "#18181b",
    muted: "#71717a",
    paper: "#ffffff",
    text: "#18181b"
  },
  {
    id: "mint",
    accent: "#059669",
    background: "#ecfdf5",
    foreground: "#064e3b",
    muted: "#047857",
    paper: "#ffffff",
    text: "#052e16"
  }
];

const formats: QrFormat[] = [
  {
    id: "table",
    aspectRatio: "108 / 152",
    compact: false,
    previewWidthClassName: "max-w-[300px]",
    qrSizeClassName: "size-[58%]"
  },
  {
    id: "tent",
    aspectRatio: "102 / 152",
    compact: false,
    previewWidthClassName: "max-w-[292px]",
    qrSizeClassName: "size-[58%]"
  },
  {
    id: "sticker",
    aspectRatio: "1 / 1",
    compact: true,
    previewWidthClassName: "max-w-[292px]",
    qrSizeClassName: "size-[72%]"
  },
  {
    id: "a6",
    aspectRatio: "105 / 148",
    compact: false,
    previewWidthClassName: "max-w-[292px]",
    qrSizeClassName: "size-[58%]"
  }
];

const qrStyles: QrVisualStyle[] = ["rounded", "square", "dots"];
const copyPresets: QrCopyPresetId[] = ["review", "complaint", "staff"];

const paletteById = Object.fromEntries(palettes.map((palette) => [palette.id, palette])) as Record<
  QrPaletteId,
  QrPalette
>;
const formatById = Object.fromEntries(formats.map((format) => [format.id, format])) as Record<
  QrFormatId,
  QrFormat
>;

const isFormatId = (value: unknown): value is QrFormatId =>
  typeof value === "string" && value in formatById;
const isPaletteId = (value: unknown): value is QrPaletteId =>
  typeof value === "string" && value in paletteById;
const isQrStyle = (value: unknown): value is QrVisualStyle =>
  typeof value === "string" && qrStyles.includes(value as QrVisualStyle);
const isCopyPresetId = (value: unknown): value is QrCopyPresetId =>
  typeof value === "string" && copyPresets.includes(value as QrCopyPresetId);

const readDraft = (storageKey = QR_DRAFT_STORAGE_KEY) => {
  const fallback = {
    copyPresetId: "review" as QrCopyPresetId,
    formatId: "table" as QrFormatId,
    paletteId: "brand" as QrPaletteId,
    qrContext: "",
    style: "rounded" as QrVisualStyle
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return fallback;
    }

    const draft = JSON.parse(raw) as Partial<typeof fallback>;

    return {
      copyPresetId: isCopyPresetId(draft.copyPresetId) ? draft.copyPresetId : fallback.copyPresetId,
      formatId: isFormatId(draft.formatId) ? draft.formatId : fallback.formatId,
      paletteId: isPaletteId(draft.paletteId) ? draft.paletteId : fallback.paletteId,
      qrContext:
        typeof draft.qrContext === "string" ? draft.qrContext.slice(0, 80) : fallback.qrContext,
      style: isQrStyle(draft.style) ? draft.style : fallback.style
    };
  } catch {
    return fallback;
  }
};

const createQr = (value: string) =>
  QRCode.create(value, {
    errorCorrectionLevel: "H"
  });

const getNextValue = <T,>(items: readonly T[], value: T) => {
  const index = items.indexOf(value);

  return items[(index + 1) % items.length];
};

const QrMatrixSvg = ({
  background,
  foreground,
  value,
  style
}: {
  background: string;
  foreground: string;
  value: string;
  style: QrVisualStyle;
}) => {
  const qr = React.useMemo(() => createQr(value), [value]);
  const quietZone = 4;
  const size = qr.modules.size + quietZone * 2;
  const modules: React.ReactNode[] = [];

  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let col = 0; col < qr.modules.size; col += 1) {
      if (!qr.modules.get(row, col)) continue;

      const x = col + quietZone;
      const y = row + quietZone;
      const key = `${row}:${col}`;

      if (style === "dots") {
        modules.push(<circle key={key} cx={x + 0.5} cy={y + 0.5} r={0.38} fill={foreground} />);
        continue;
      }

      if (style === "rounded") {
        modules.push(
          <rect
            key={key}
            fill={foreground}
            height={0.92}
            rx={0.22}
            width={0.92}
            x={x + 0.04}
            y={y + 0.04}
          />
        );
        continue;
      }

      modules.push(<rect key={key} fill={foreground} height={1} width={1} x={x} y={y} />);
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      className="h-full w-full"
      shapeRendering={style === "square" ? "crispEdges" : "geometricPrecision"}
    >
      <rect fill={background} height={size} width={size} />
      {modules}
    </svg>
  );
};

const PlaceLogo = ({
  name,
  palette,
  size = "md"
}: {
  name: string;
  palette: QrPalette;
  size?: "md" | "sm";
}) => (
  <span
    className={cn(
      "grid shrink-0 place-items-center rounded-[14px] text-white",
      size === "md" ? "size-12 ios-title-3 font-bold" : "size-9 ios-footnote font-bold"
    )}
    style={{
      background: palette.accent
    }}
  >
    {name.trim().slice(0, 1).toUpperCase() || "I"}
  </span>
);

const QrBlock = ({
  centerLogo,
  className,
  name,
  palette,
  style,
  value
}: {
  centerLogo?: boolean;
  className: string;
  name: string;
  palette: QrPalette;
  style: QrVisualStyle;
  value: string;
}) => (
  <span className={cn("relative mx-auto grid place-items-center", className)}>
    <QrMatrixSvg
      background={palette.paper}
      foreground={palette.foreground}
      style={style}
      value={value}
    />
    {centerLogo ? (
      <span className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[16px] bg-white p-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.12)]">
        <PlaceLogo name={name} palette={palette} size="sm" />
      </span>
    ) : null}
  </span>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="ios-caption-1 px-1 font-semibold uppercase text-muted">{children}</h2>
);

const SegmentPicker = <T extends string>({
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
              : "bg-foreground/[0.045] text-muted hover:bg-foreground/[0.07] hover:text-foreground dark:bg-white/[0.055] dark:hover:bg-white/[0.08]"
          )}
        >
          {getLabel(item)}
        </button>
      );
    })}
  </div>
);

const PalettePicker = ({
  onChange,
  paletteId,
  t
}: {
  onChange: (value: QrPaletteId) => void;
  paletteId: QrPaletteId;
  t: (key: string) => string;
}) => (
  <div className="scrollbar-hide flex gap-2 overflow-x-auto py-1">
    {palettes.map((palette) => {
      const active = palette.id === paletteId;

      return (
        <button
          key={palette.id}
          type="button"
          onClick={() => {
            if (!active) {
              tmaHaptics.selection();
            }

            onChange(palette.id);
          }}
          className={cn(
            "ios-touch-target ios-footnote relative inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 pr-3 font-medium transition-colors",
            active
              ? "bg-surface-2 text-foreground shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-border/70 dark:bg-surface-3 dark:ring-white/10"
              : "bg-foreground/[0.045] text-muted hover:bg-foreground/[0.07] hover:text-foreground dark:bg-white/[0.055] dark:hover:bg-white/[0.08]"
          )}
        >
          <span className="flex -space-x-1">
            <span
              className="size-5 rounded-full ring-2 ring-surface"
              style={{ background: palette.foreground }}
            />
            <span
              className="size-5 rounded-full ring-2 ring-surface"
              style={{ background: palette.accent }}
            />
            <span
              className="size-5 rounded-full ring-2 ring-surface"
              style={{ background: palette.background }}
            />
          </span>
          <span>{t(`qr.constructor.palette.${palette.id}`)}</span>
          {active ? <Check size={14} strokeWidth={2.6} /> : null}
        </button>
      );
    })}
  </div>
);

const SettingRow = ({
  label,
  onClick,
  value
}: {
  label: string;
  onClick: () => void;
  value: string;
}) => (
  <button
    type="button"
    onClick={() => {
      tmaHaptics.impact("light");
      onClick();
    }}
    className="ios-touch-target flex w-full items-center justify-between gap-4 border-b border-foreground/[0.065] px-1 text-left transition-colors last:border-b-0 hover:bg-surface/44"
  >
    <span className="ios-body font-normal text-foreground">{label}</span>
    <span className="ios-subhead min-w-0 max-w-[54%] truncate text-right font-medium text-muted">
      {value}
    </span>
  </button>
);

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
  const initialDraft = React.useMemo(readDraft, []);
  const [formatId, setFormatId] = React.useState<QrFormatId>(initialDraft.formatId);
  const [paletteId, setPaletteId] = React.useState<QrPaletteId>(initialDraft.paletteId);
  const [style, setStyle] = React.useState<QrVisualStyle>(initialDraft.style);
  const [copyPresetId, setCopyPresetId] = React.useState<QrCopyPresetId>(initialDraft.copyPresetId);
  const [qrContext, setQrContext] = React.useState(initialDraft.qrContext);

  const format = formatById[formatId];
  const palette = paletteById[paletteId];
  const cleanQrContext = qrContext.replace(/\s+/g, " ").trim().slice(0, 80);
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
    const draft = readDraft(qrDraftStorageKey);

    setFormatId(draft.formatId);
    setPaletteId(draft.paletteId);
    setQrContext(draft.qrContext);
    setStyle(draft.style);
    setCopyPresetId(draft.copyPresetId);
  }, [qrDraftStorageKey]);

  const saveDraft = () => {
    window.localStorage.setItem(
      qrDraftStorageKey,
      JSON.stringify({
        copyPresetId,
        formatId,
        paletteId,
        qrContext: cleanQrContext,
        style
      })
    );
    tmaHaptics.notification("success");
  };

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
        <div className="mx-auto grid w-full max-w-[620px] gap-7 px-4 pt-7 sm:px-6 lg:pt-9">
          <section className="grid gap-1 px-1">
            <h1 className="ios-title-1 font-semibold tracking-normal text-foreground">
              {t("qr.constructor.title")}
            </h1>
            <p className="ios-footnote text-muted">{t("qr.constructor.context.hint")}</p>
          </section>

          <section className="iz-glass iz-liquid-list relative grid justify-items-center gap-4 rounded-[28px] p-4">
            <div
              className={cn(
                "grid w-full overflow-hidden rounded-[22px] p-5 text-center ring-1 ring-foreground/[0.06]",
                format.previewWidthClassName
              )}
              style={{
                aspectRatio: format.aspectRatio,
                background: palette.paper,
                boxShadow: "0 18px 46px rgba(17, 17, 19, 0.12)",
                color: palette.text
              }}
            >
              <div
                className={cn(
                  "grid min-h-full justify-items-center",
                  format.compact ? "content-center gap-4" : "content-between gap-5"
                )}
              >
                {format.compact ? (
                  <div className="grid max-w-full justify-items-center gap-1">
                    <h2 className="ios-title-2 max-w-full truncate font-semibold tracking-normal">
                      {organizationName}
                    </h2>
                    {cleanQrContext ? (
                      <p className="ios-footnote max-w-full truncate font-semibold text-current/70">
                        {cleanQrContext}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid justify-items-center gap-2">
                    <PlaceLogo name={organizationName} palette={palette} />
                    <h2 className="ios-title-2 max-w-full truncate font-semibold tracking-normal">
                      {organizationName}
                    </h2>
                    {cleanQrContext ? (
                      <p className="ios-footnote max-w-full truncate font-semibold text-current/70">
                        {cleanQrContext}
                      </p>
                    ) : null}
                  </div>
                )}

                {qrTargetUrl ? (
                  <QrBlock
                    centerLogo={format.compact}
                    className={format.qrSizeClassName}
                    name={organizationName}
                    palette={palette}
                    style={style}
                    value={qrTargetUrl}
                  />
                ) : (
                  <span
                    className={cn("relative mx-auto block", format.qrSizeClassName)}
                    aria-hidden="true"
                  />
                )}

                {!format.compact ? (
                  <p
                    className="ios-footnote max-w-[230px] font-medium"
                    style={{ color: palette.muted }}
                  >
                    {t(`qr.constructor.copyPresets.${copyPresetId}.description`)}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="ios-caption-1 text-center font-medium text-muted">
              {t(`qr.constructor.formats.${formatId}.description`)}
            </p>
          </section>

          <section className="grid gap-2">
            <SectionTitle>{t("qr.constructor.formats.title")}</SectionTitle>
            <SegmentPicker
              items={formats.map((item) => item.id)}
              value={formatId}
              onChange={setFormatId}
              getLabel={(item) => t(`qr.constructor.formats.${item}.name`)}
            />
          </section>

          <section className="grid gap-2">
            <SectionTitle>{t("qr.constructor.palette.title")}</SectionTitle>
            <PalettePicker paletteId={paletteId} t={t} onChange={setPaletteId} />
          </section>

          <section className="grid gap-2">
            <SectionTitle>{t("qr.constructor.context.title")}</SectionTitle>
            <Input
              clearLabel={t("common.actions.clear")}
              maxLength={80}
              placeholder={t("qr.constructor.context.placeholder")}
              value={qrContext}
              onChange={(event) => setQrContext(event.target.value)}
            />
            <p className="ios-footnote px-1 text-muted">{t("qr.constructor.context.hint")}</p>
          </section>

          <section className="iz-glass iz-liquid-list relative grid gap-1 overflow-hidden rounded-[22px] px-4">
            <SettingRow
              label={t("qr.constructor.copy")}
              value={t(`qr.constructor.copyPresets.${copyPresetId}.name`)}
              onClick={() => setCopyPresetId(getNextValue(copyPresets, copyPresetId))}
            />
            <SettingRow
              label={t("qr.constructor.style")}
              value={t(`qr.constructor.qrStyle.${style}`)}
              onClick={() => setStyle(getNextValue(qrStyles, style))}
            />
            <SettingRow
              label={t("qr.constructor.fit")}
              value={t(`qr.constructor.formats.${formatId}.size`)}
              onClick={() =>
                setFormatId(
                  getNextValue(
                    formats.map((item) => item.id),
                    formatId
                  )
                )
              }
            />
          </section>

          <Button variant="secondary" type="button" onClick={saveDraft} wide>
            <Check size={16} />
            {t("qr.constructor.save")}
          </Button>
        </div>
      </main>
    </PageTransition>
  );
};
