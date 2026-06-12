import { useNavigate, useParams } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  MapPin,
  MessageCircleWarning,
  MessageSquareText,
  QrCode,
  RefreshCw,
  Star,
  UserRound,
  UsersRound,
  X,
  type LucideIcon
} from "lucide-react";
import * as React from "react";

import { Button, PendingScreen } from "~/common/ui";
import { cn } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import { useAdminOrganization } from "~/shared/admin";
import { getIntlLocale } from "~/shared/i18n";
import { useI18n } from "~/shared/i18n/react";
import { queryKeys } from "~/shared/query";
import { getRatingEmoji, getRatingLabelKey } from "~/shared/ratings";
import { PageTransition } from "~/shared/router/page-transition";
import { openTmaTelegramLink, tmaHaptics, useTma, useTmaBackButton } from "~/shared/tma";
import type {
  AdminSubmissionItem,
  AdminSubmissionsPayload,
  SubmissionKindInput
} from "~/shared/submissions";

type FeedFilter = "ALL" | SubmissionKindInput;

type KindMeta = {
  avatarTone: string;
  icon: LucideIcon;
  labelTone: string;
};

const kindMeta: Record<SubmissionKindInput, KindMeta> = {
  COMPLAINT: {
    avatarTone: "bg-[#FF2D55] text-white",
    icon: MessageCircleWarning,
    labelTone: "text-danger"
  },
  REVIEW: {
    avatarTone: "bg-[#FFB000] text-white",
    icon: Star,
    labelTone: "text-warning"
  },
  SUGGESTION: {
    avatarTone: "bg-[#34C759] text-white",
    icon: Lightbulb,
    labelTone: "text-success"
  }
};

const filters = [
  "ALL",
  "REVIEW",
  "COMPLAINT",
  "SUGGESTION"
] as const satisfies readonly FeedFilter[];

const SUBMISSIONS_PAGE_SIZE = 24;

const emptyCounts = {
  ALL: 0,
  COMPLAINT: 0,
  REVIEW: 0,
  SUGGESTION: 0
} satisfies AdminSubmissionsPayload["counts"];

const getSubmissionTopicIds = (submission: AdminSubmissionItem) => {
  if (submission.kind === "COMPLAINT") {
    return submission.metadata.complaintCategoryIds ?? [];
  }

  if (submission.kind === "SUGGESTION") {
    return submission.metadata.suggestionTopicIds ?? [];
  }

  return [];
};

const formatSubmissionDate = (value: string, locale: string) =>
  new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));

const formatDateSeparator = (
  value: string,
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const date = new Date(value);
  const now = new Date();
  const startOfDay = (input: Date) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (dayDiff === 0) {
    return t("admin.feed.date.today");
  }

  if (dayDiff === 1) {
    return t("admin.feed.date.yesterday");
  }

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: "numeric",
    month: "long"
  }).format(date);
};

const getDateKey = (value: string) => {
  const date = new Date(value);

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const getRatingTone = (rating: number): "danger" | "success" | "warning" => {
  if (rating <= 2) return "danger";
  if (rating === 3) return "warning";
  return "success";
};

const getRatingText = (
  rating: number,
  t: (key: string, options?: Record<string, unknown>) => string
) => `${getRatingEmoji(rating)} ${t(getRatingLabelKey(rating))}`;

const isImportantSubmission = (submission: AdminSubmissionItem) =>
  submission.kind === "COMPLAINT" ||
  (submission.kind === "REVIEW" && typeof submission.rating === "number" && submission.rating <= 3);

const getStaffTargetMeta = (
  submission: AdminSubmissionItem,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  if (submission.targetStaffMember) {
    const value = [
      submission.targetStaffMember.displayName,
      submission.targetStaffMember.roleTitle || null
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      icon: UserRound,
      label: t("admin.feed.meta.target", {
        value
      })
    };
  }

  if (submission.metadata.staffTargetType === "team") {
    return {
      icon: UsersRound,
      label: t("admin.feed.meta.targetTeam")
    };
  }

  if (submission.metadata.staffTargetType === "unknown") {
    return {
      icon: UsersRound,
      label: t("admin.feed.meta.targetUnknown")
    };
  }

  return null;
};

const getEmptyMessageText = (
  submission: AdminSubmissionItem,
  t: (key: string, options?: Record<string, unknown>) => string
) => t(`admin.feed.emptyMessage.${submission.kind}`);

const normalizePhoneHref = (value: string) => {
  const compact = value.trim().replace(/[\s().-]/g, "");

  return /^\+?\d{6,18}$/.test(compact) ? `tel:${compact}` : null;
};

const getTelegramUsername = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(?:@|(?:https?:\/\/)?t\.me\/)([A-Za-z0-9_]{5,32})(?:\/)?$/i);

  return match?.[1] ?? null;
};

const getContactAction = (value: string) => {
  const username = getTelegramUsername(value);

  if (username) {
    return {
      href: `https://t.me/${username}`,
      kind: "telegram" as const,
      label: `@${username}`
    };
  }

  const phoneHref = normalizePhoneHref(value);

  if (phoneHref) {
    return {
      href: phoneHref,
      kind: "phone" as const,
      label: value.trim()
    };
  }

  return {
    href: undefined,
    kind: "text" as const,
    label: value.trim()
  };
};

const feedPillToneClassNames = {
  danger:
    "border-danger/12 bg-danger/[0.07] text-danger dark:border-danger/16 dark:bg-danger/[0.14]",
  neutral:
    "border-foreground/[0.06] bg-foreground/[0.045] text-muted dark:border-white/[0.06] dark:bg-white/[0.07]",
  primary:
    "border-primary/12 bg-primary/[0.07] text-primary dark:border-primary/16 dark:bg-primary/[0.14]",
  success:
    "border-success/12 bg-success/[0.07] text-success dark:border-success/16 dark:bg-success/[0.14]",
  warning:
    "border-warning/14 bg-warning/[0.09] text-warning dark:border-warning/18 dark:bg-warning/[0.16]"
} as const;

type FeedPillTone = keyof typeof feedPillToneClassNames;

type SubmissionPill = {
  href?: string;
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  tone: FeedPillTone;
};

type MetaLineItem = {
  href?: string;
  icon?: LucideIcon;
  interactive?: boolean;
  label?: string;
  onClick?: () => void;
  prefix?: string;
  value?: string;
};

const FeedPill = ({
  children,
  href,
  icon: Icon,
  onClick,
  tone = "neutral"
}: {
  children: React.ReactNode;
  href?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  tone?: FeedPillTone;
}) => {
  const isInteractive = Boolean(href || onClick);
  const className = cn(
    "ios-caption-1 inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-[10px] border px-2 font-medium",
    feedPillToneClassNames[tone],
    isInteractive && "cursor-pointer transition-opacity active:opacity-65"
  );
  const content = (
    <>
      {Icon ? <Icon className="shrink-0" size={13} strokeWidth={2.35} /> : null}
      <span className="min-w-0 truncate">{children}</span>
    </>
  );

  if (href) {
    return (
      <a
        className={className}
        href={href}
        onClick={(event) => {
          event.stopPropagation();
          tmaHaptics.impact("light");
        }}
      >
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.stopPropagation();
          tmaHaptics.impact("light");
          onClick();
        }}
      >
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
};

const SubmissionMetaLine = ({ items }: { items: MetaLineItem[] }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="ios-caption-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 px-1 pt-0.5 font-medium text-muted">
      {items.map((item, index) => {
        const label = item.label ?? [item.prefix, item.value].filter(Boolean).join(" ");
        const content = (
          <>
            {item.icon ? <item.icon className="shrink-0" size={12} strokeWidth={2.4} /> : null}
            {item.prefix && item.value ? (
              <span className="min-w-0 truncate">
                <span>{item.prefix}: </span>
                <span className={item.interactive ? "font-semibold text-primary" : undefined}>
                  {item.value}
                </span>
              </span>
            ) : (
              <span className="min-w-0 truncate">{label}</span>
            )}
          </>
        );
        const interactive = Boolean(item.href || item.onClick || item.interactive);
        const className = cn(
          "inline-flex min-w-0 max-w-full items-center gap-1 rounded-[8px] transition-opacity",
          interactive && "active:opacity-65"
        );

        return (
          <React.Fragment key={`${label}-${index}`}>
            {index > 0 ? <span className="text-muted/48">·</span> : null}
            {item.href ? (
              <a
                className={className}
                href={item.href}
                onClick={(event) => {
                  event.stopPropagation();
                  tmaHaptics.impact("light");
                }}
              >
                {content}
              </a>
            ) : item.onClick ? (
              <button
                type="button"
                className={className}
                onClick={(event) => {
                  event.stopPropagation();
                  tmaHaptics.impact("light");
                  item.onClick?.();
                }}
              >
                {content}
              </button>
            ) : (
              <span className={className}>{content}</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const SubmissionText = ({
  children,
  isMuted,
  t
}: {
  children: string;
  isMuted: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const shouldClamp = children.length > 420 || children.split("\n").length > 7;

  return (
    <div className="grid gap-1 px-1">
      <p
        className={cn(
          "ios-body whitespace-pre-wrap leading-snug",
          !expanded && shouldClamp && "line-clamp-[7]",
          isMuted ? "text-muted" : "text-foreground"
        )}
      >
        {children}
      </p>
      {shouldClamp ? (
        <button
          type="button"
          className="ios-footnote w-fit font-semibold text-primary active:opacity-70"
          onClick={() => {
            tmaHaptics.selection();
            setExpanded((value) => !value);
          }}
        >
          {t(expanded ? "admin.feed.text.showLess" : "admin.feed.text.showMore")}
        </button>
      ) : null}
    </div>
  );
};

const TypeAvatar = ({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) => (
  <span
    className={cn(
      "mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full leading-none shadow-[0_7px_18px_rgba(0,0,0,0.12)] ring-1 ring-white/25",
      tone
    )}
  >
    <Icon className="block size-[17px]" strokeWidth={2.35} />
  </span>
);

const SubmissionMediaGrid = ({
  attachments,
  onOpen,
  t
}: {
  attachments: AdminSubmissionItem["attachments"];
  onOpen: (index: number) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  const count = attachments.length;

  if (count === 0) {
    return null;
  }

  if (count === 1) {
    const attachment = attachments[0];

    if (!attachment) {
      return null;
    }

    return (
      <button
        type="button"
        className="-mx-0.5 block aspect-[4/3] overflow-hidden rounded-[20px] bg-foreground/[0.06] active:opacity-85 dark:bg-white/[0.08]"
        onClick={() => onOpen(0)}
      >
        <img
          src={attachment.publicUrl}
          alt={t("admin.feed.photoAlt", {
            index: 1
          })}
          className="size-full object-cover"
          loading="lazy"
        />
      </button>
    );
  }

  if (count === 3) {
    return (
      <div className="-mx-0.5 grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-[20px] bg-foreground/[0.06] dark:bg-white/[0.08]">
        {attachments.map((attachment, index) => (
          <button
            key={attachment.id}
            type="button"
            className={cn("overflow-hidden active:opacity-85", index === 0 && "row-span-2")}
            onClick={() => onOpen(index)}
          >
            <img
              src={attachment.publicUrl}
              alt={t("admin.feed.photoAlt", {
                index: index + 1
              })}
              className="size-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "-mx-0.5 grid gap-0.5 overflow-hidden rounded-[20px] bg-foreground/[0.06] dark:bg-white/[0.08]",
        count === 2 ? "grid-cols-2" : "grid-cols-2"
      )}
    >
      {attachments.map((attachment, index) => (
        <button
          key={attachment.id}
          type="button"
          className="aspect-square overflow-hidden active:opacity-85"
          onClick={() => onOpen(index)}
        >
          <img
            src={attachment.publicUrl}
            alt={t("admin.feed.photoAlt", {
              index: index + 1
            })}
            className="size-full object-cover"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
};

const SubmissionBubble = ({
  locale,
  onOpenAttachment,
  submission,
  t
}: {
  locale: string;
  onOpenAttachment: (submission: AdminSubmissionItem, index: number) => void;
  submission: AdminSubmissionItem;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  const meta = kindMeta[submission.kind];
  const Icon = meta.icon;
  const topicIds = getSubmissionTopicIds(submission);
  const topicNamespace = submission.kind === "COMPLAINT" ? "complaint" : "suggestion";
  const topicLabels = topicIds.map((topicId) =>
    t(`customer.topicOptions.${topicNamespace}.${topicId}`)
  );
  const visibleTopicLabels =
    topicLabels.length > 3
      ? [...topicLabels.slice(0, 3), `+${topicLabels.length - 3}`]
      : topicLabels;
  const staffTargetMeta = getStaffTargetMeta(submission, t);
  const contactAction = submission.customerContactPhone
    ? getContactAction(submission.customerContactPhone)
    : null;
  const ratingTone =
    typeof submission.rating === "number" ? getRatingTone(submission.rating) : undefined;
  const important = isImportantSubmission(submission);
  const bodyText = submission.bodyText.trim();
  const visibleText = bodyText || getEmptyMessageText(submission, t);
  const primaryPills: SubmissionPill[] = [
    ...(important
      ? [
          {
            icon: AlertTriangle,
            label: t("admin.feed.signals.important"),
            tone: "danger" as const
          }
        ]
      : []),
    ...(typeof submission.rating === "number"
      ? [
          {
            label: getRatingText(submission.rating, t),
            tone: ratingTone ?? ("neutral" as const)
          }
        ]
      : []),
    ...(visibleTopicLabels.length > 0
      ? visibleTopicLabels.map((topicLabel) => ({
          icon: MessageSquareText,
          label: topicLabel,
          tone: "primary" as const
        }))
      : [])
  ];
  const contextLineItems: MetaLineItem[] = [
    ...(submission.qrContext
      ? [
          {
            href: undefined,
            icon: MapPin,
            label: submission.qrContext
          }
        ]
      : []),
    ...(staffTargetMeta
      ? [
          {
            href: undefined,
            icon: staffTargetMeta.icon,
            label: staffTargetMeta.label
          }
        ]
      : []),
    ...(submission.customerDisplayName
      ? [
          {
            href: undefined,
            icon: UserRound,
            label: submission.customerDisplayName
          }
        ]
      : [])
  ];
  const contactLineItems: MetaLineItem[] = [
    ...(contactAction
      ? [
          {
            href: contactAction.kind === "phone" ? contactAction.href : undefined,
            interactive: contactAction.kind !== "text",
            onClick:
              contactAction.kind === "telegram"
                ? () => openTmaTelegramLink(contactAction.href)
                : undefined,
            prefix: t("admin.feed.meta.contact"),
            value: contactAction.label
          }
        ]
      : [])
  ];
  const bubbleClassName = cn(
    "w-full max-w-[520px] rounded-[22px] rounded-bl-[6px] border px-2.5 py-2 backdrop-blur-2xl",
    important
      ? "border-danger/12 bg-danger/[0.06] dark:border-danger/18 dark:bg-danger/[0.14]"
      : "border-foreground/[0.055] bg-surface-2/82 dark:border-white/[0.07] dark:bg-white/[0.085]"
  );

  return (
    <article className="flex w-full items-end gap-1.5 px-1">
      <TypeAvatar icon={Icon} tone={meta.avatarTone} />

      <div className={bubbleClassName}>
        <div className="grid gap-1.5">
          <header className="flex min-w-0 items-center px-1">
            <div className="grid min-w-0 gap-0.5">
              <span className={cn("ios-footnote font-semibold", meta.labelTone)}>
                {t(`admin.feed.kind.${submission.kind}`)}
              </span>
            </div>
          </header>

          <SubmissionMediaGrid
            attachments={submission.attachments}
            onOpen={(index) => onOpenAttachment(submission, index)}
            t={t}
          />

          <SubmissionText isMuted={!bodyText} t={t}>
            {visibleText}
          </SubmissionText>

          {primaryPills.length > 0 ? (
            <div className="flex min-w-0 flex-wrap gap-1.5 px-1 pt-0.5">
              {primaryPills.map((pill, index) => (
                <FeedPill key={`${pill.label}-${index}`} icon={pill.icon} tone={pill.tone}>
                  {pill.label}
                </FeedPill>
              ))}
            </div>
          ) : null}

          <SubmissionMetaLine items={contextLineItems} />
          <SubmissionMetaLine items={contactLineItems} />

          <footer className="flex justify-end px-1">
            <span className="ios-caption-1 font-medium text-muted/80">
              {formatSubmissionDate(submission.createdAt, locale)}
            </span>
          </footer>
        </div>
      </div>
    </article>
  );
};

const FeedEmptyState = ({
  actionLabel,
  description,
  onAction,
  title
}: {
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
}) => (
  <div className="iz-liquid-list grid justify-items-center gap-2 rounded-[28px] border border-transparent p-6 text-center">
    <span className="grid size-11 place-items-center rounded-full bg-[#2AABEE] text-white">
      <MessageSquareText size={17} strokeWidth={2.35} />
    </span>
    <h3 className="ios-headline text-foreground">{title}</h3>
    <p className="ios-footnote max-w-[280px] text-muted">{description}</p>
    {actionLabel && onAction ? (
      <Button className="mt-1" size="sm" type="button" onClick={onAction}>
        <QrCode size={16} strokeWidth={2.35} />
        {actionLabel}
      </Button>
    ) : null}
  </div>
);

const SubmissionGallery = ({
  gallery,
  onClose,
  onSelect,
  t
}: {
  gallery: {
    attachments: AdminSubmissionItem["attachments"];
    index: number;
  } | null;
  onClose: () => void;
  onSelect: (index: number) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  if (!gallery) {
    return null;
  }

  const attachment = gallery.attachments[gallery.index];
  const hasMultiple = gallery.attachments.length > 1;

  if (!attachment) {
    return null;
  }

  const selectNext = () => {
    tmaHaptics.selection();
    onSelect((gallery.index + 1) % gallery.attachments.length);
  };
  const selectPrevious = () => {
    tmaHaptics.selection();
    onSelect((gallery.index - 1 + gallery.attachments.length) % gallery.attachments.length);
  };

  return (
    <div className="fixed inset-0 z-50 grid bg-black/94 text-white">
      <button
        type="button"
        aria-label={t("admin.feed.gallery.close")}
        className="absolute right-4 top-[max(16px,var(--iz-safe-top))] z-10 grid size-11 place-items-center rounded-full bg-white/12 text-white backdrop-blur-xl active:bg-white/18"
        onClick={onClose}
      >
        <X size={22} strokeWidth={2.45} />
      </button>

      {hasMultiple ? (
        <>
          <button
            type="button"
            aria-label={t("admin.feed.gallery.previous")}
            className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-xl active:bg-white/18"
            onClick={selectPrevious}
          >
            <ChevronLeft size={24} strokeWidth={2.45} />
          </button>
          <button
            type="button"
            aria-label={t("admin.feed.gallery.next")}
            className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-xl active:bg-white/18"
            onClick={selectNext}
          >
            <ChevronRight size={24} strokeWidth={2.45} />
          </button>
        </>
      ) : null}

      <div className="grid min-h-0 place-items-center px-3 py-[max(74px,var(--iz-safe-top))]">
        <img
          src={attachment.publicUrl}
          alt={t("admin.feed.photoAlt", {
            index: gallery.index + 1
          })}
          className="max-h-full max-w-full rounded-[18px] object-contain"
        />
      </div>

      {hasMultiple ? (
        <div className="scrollbar-hide fixed inset-x-0 bottom-[max(16px,var(--iz-safe-bottom))] flex justify-center gap-2 overflow-x-auto px-4">
          {gallery.attachments.map((item, index) => {
            const active = index === gallery.index;

            return (
              <button
                key={item.id}
                type="button"
                aria-label={t("admin.feed.photoAlt", {
                  index: index + 1
                })}
                className={cn(
                  "size-14 shrink-0 overflow-hidden rounded-[13px] transition-opacity",
                  active ? "ring-2 ring-white" : "opacity-54 active:opacity-80"
                )}
                onClick={() => {
                  tmaHaptics.selection();
                  onSelect(index);
                }}
              >
                <img src={item.publicUrl} alt="" className="size-full object-cover" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export const AdminFeedPage = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/admin/$organizationId/feed" });
  const tma = useTma();
  const { locale, t } = useI18n();
  const {
    isLoading: isOrganizationsLoading,
    organizations,
    setActiveOrganizationId
  } = useAdminOrganization();
  const [filter, setFilter] = React.useState<FeedFilter>("ALL");
  const [gallery, setGallery] = React.useState<{
    attachments: AdminSubmissionItem["attachments"];
    index: number;
  } | null>(null);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  const backToOrganization = React.useCallback(() => {
    void navigate({
      params: { organizationId: params.organizationId },
      to: "/admin/$organizationId"
    });
  }, [navigate, params.organizationId]);
  const closeGallery = React.useCallback(() => {
    setGallery(null);
  }, []);
  const handleBack = React.useCallback(() => {
    if (gallery) {
      closeGallery();
      return;
    }

    backToOrganization();
  }, [backToOrganization, closeGallery, gallery]);
  const openGallery = React.useCallback((submission: AdminSubmissionItem, index: number) => {
    if (submission.attachments.length === 0) {
      return;
    }

    tmaHaptics.impact("light");
    setGallery({
      attachments: submission.attachments,
      index
    });
  }, []);
  const selectGalleryIndex = React.useCallback((index: number) => {
    setGallery((current) => (current ? { ...current, index } : current));
  }, []);
  const openQrConstructor = React.useCallback(() => {
    void navigate({
      params: { organizationId: params.organizationId },
      to: "/admin/$organizationId/qr"
    });
  }, [navigate, params.organizationId]);
  const organization =
    organizations.find((item) => item.id === params.organizationId) ??
    organizations.find((item) => item.slug === params.organizationId) ??
    null;
  const submissionsQuery = useInfiniteQuery({
    enabled: tma.isReady,
    getNextPageParam: (lastPage: AdminSubmissionsPayload) => lastPage.nextCursor,
    initialPageParam: null as null | string,
    queryFn: ({ pageParam }) => {
      const queryParams = new URLSearchParams({
        limit: String(SUBMISSIONS_PAGE_SIZE)
      });

      if (filter !== "ALL") {
        queryParams.set("kind", filter);
      }

      if (pageParam) {
        queryParams.set("cursor", pageParam);
      }

      return fetchApiJson<AdminSubmissionsPayload>(
        `/api/organizations/${params.organizationId}/submissions?${queryParams.toString()}`,
        {
          initDataRaw: tma.initDataRaw
        }
      );
    },
    queryKey: queryKeys.submissions(params.organizationId, filter, tma.initDataRaw)
  });
  const firstPage = submissionsQuery.data?.pages[0] ?? null;
  const counts = firstPage?.counts ?? emptyCounts;
  const items = submissionsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const hasAnyItems = counts.ALL > 0;
  const feedRows = items.map((submission, index) => {
    const previousSubmission = items[index - 1];
    const dateKey = getDateKey(submission.createdAt);
    const showDateSeparator =
      !previousSubmission || getDateKey(previousSubmission.createdAt) !== dateKey;

    return {
      dateLabel: showDateSeparator ? formatDateSeparator(submission.createdAt, locale, t) : null,
      submission
    };
  });

  React.useEffect(() => {
    if (organization) {
      setActiveOrganizationId(organization.id);
    }
  }, [organization, setActiveOrganizationId]);

  React.useEffect(() => {
    const node = loadMoreRef.current;

    if (!node || !submissionsQuery.hasNextPage || submissionsQuery.isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void submissionsQuery.fetchNextPage();
        }
      },
      {
        rootMargin: "520px 0px"
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [
    submissionsQuery.fetchNextPage,
    submissionsQuery.hasNextPage,
    submissionsQuery.isFetchingNextPage
  ]);

  useTmaBackButton(true, handleBack);

  if ((isOrganizationsLoading && !organization) || (submissionsQuery.isPending && !firstPage)) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  if (submissionsQuery.isError && !firstPage) {
    return (
      <PageTransition>
        <main className="tma-page bg-surface text-foreground">
          <div className="account-shell">
            <section className="grid gap-2">
              <h2 className="ios-title-1 font-semibold tracking-normal text-foreground">
                {t("admin.feed.title")}
              </h2>
            </section>

            <div className="iz-liquid-list grid justify-items-center gap-3 rounded-[28px] border border-transparent p-6 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-[#FF3B30] text-white">
                <AlertTriangle size={17} strokeWidth={2.35} />
              </span>
              <div className="grid gap-1">
                <h3 className="ios-headline text-foreground">{t("admin.feed.loadErrorTitle")}</h3>
                <p className="ios-footnote max-w-[280px] text-muted">
                  {t("admin.feed.loadErrorHint")}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  tma.haptics.impact("light");
                  void submissionsQuery.refetch();
                }}
              >
                <RefreshCw size={16} />
                {t("admin.feed.retry")}
              </Button>
            </div>
          </div>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <section className="grid gap-3">
            <h2 className="ios-title-1 font-semibold tracking-normal text-foreground">
              {t("admin.feed.title")}
            </h2>

            <div className="scrollbar-hide -mx-4 flex gap-1 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6">
              {filters.map((item) => {
                const active = item === filter;

                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "ios-touch-target ios-footnote relative shrink-0 rounded-full px-3.5 font-medium transition-colors",
                      active
                        ? "bg-surface-2 text-foreground shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-border/70 dark:bg-surface-3 dark:ring-white/10"
                        : "bg-foreground/[0.045] text-muted hover:bg-foreground/[0.07] hover:text-foreground dark:bg-white/[0.055] dark:hover:bg-white/[0.08]"
                    )}
                    onClick={() => {
                      tma.haptics.selection();
                      setFilter(item);
                    }}
                  >
                    {t(`admin.feed.filters.${item}`)}
                    <span className="ml-1 text-current/60">{counts[item]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-3">
            {items.length > 0 ? (
              <div className="grid gap-3">
                {feedRows.map(({ dateLabel, submission }) => (
                  <React.Fragment key={submission.id}>
                    {dateLabel ? (
                      <div className="ios-caption-1 justify-self-center rounded-full bg-foreground/[0.055] px-3 py-1 font-semibold text-muted dark:bg-white/[0.07]">
                        {dateLabel}
                      </div>
                    ) : null}
                    <SubmissionBubble
                      locale={locale}
                      onOpenAttachment={openGallery}
                      submission={submission}
                      t={t}
                    />
                  </React.Fragment>
                ))}
                {submissionsQuery.hasNextPage ? (
                  <div ref={loadMoreRef} aria-hidden="true" className="h-1" />
                ) : null}
              </div>
            ) : (
              <FeedEmptyState
                title={t(hasAnyItems ? "admin.feed.emptyFilteredTitle" : "admin.feed.emptyTitle")}
                description={t(
                  hasAnyItems ? "admin.feed.emptyFilteredHint" : "admin.feed.emptyHint"
                )}
                actionLabel={hasAnyItems ? undefined : t("admin.feed.emptyAction")}
                onAction={hasAnyItems ? undefined : openQrConstructor}
              />
            )}
          </section>
        </div>
        <SubmissionGallery
          gallery={gallery}
          onClose={() => {
            tmaHaptics.impact("light");
            closeGallery();
          }}
          onSelect={selectGalleryIndex}
          t={t}
        />
      </main>
    </PageTransition>
  );
};
