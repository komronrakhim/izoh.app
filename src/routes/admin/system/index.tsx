import { useNavigate, useParams } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Gift,
  Image as ImageIcon,
  Lightbulb,
  MapPin,
  MessageCircleWarning,
  MessageSquareText,
  Radar,
  ScanLine,
  Search,
  ShieldCheck,
  Star,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import * as React from "react";

import { Avatar } from "~/common/components";
import { Button, Input, List, ListIcon, PendingScreen, Tabs } from "~/common/ui";
import { cn } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import { useAdminOrganization } from "~/shared/admin";
import { getIntlLocale } from "~/shared/i18n";
import { useI18n } from "~/shared/i18n/react";
import { queryKeys } from "~/shared/query";
import { PageTransition } from "~/shared/router/page-transition";
import type { SubscriptionPlanCode } from "~/shared/subscriptions";
import type { SubmissionKindInput } from "~/shared/submissions";
import {
  SYSTEM_PULSE_PERIODS,
  type SystemOrganizationDetailPayload,
  type SystemOrganizationsPayload,
  type SystemPulseMetric,
  type SystemPulsePayload,
  type SystemPulsePeriod,
  type SystemStarsPayload,
  type SystemSubmissionItem,
  type SystemSubmissionsPayload,
  type SystemUserDetailPayload,
  type SystemUserItem,
  type SystemUsersPayload
} from "~/shared/system";
import { showTmaPopup, useTma, useTmaBackButton } from "~/shared/tma";

type SystemMetricId =
  | "activeSubscriptions"
  | "organizations"
  | "paidStars"
  | "scans"
  | "submissions"
  | "users";

type SystemSectionId = "organizations" | "stars" | "submissions" | "users";

type SystemMetricMeta = {
  icon: LucideIcon;
  tone: string;
  totalFirst?: boolean;
};

const metricMeta: Record<SystemMetricId, SystemMetricMeta> = {
  activeSubscriptions: {
    icon: BadgeCheck,
    tone: "bg-[#30B0C7] text-white",
    totalFirst: true
  },
  organizations: {
    icon: Building2,
    tone: "bg-[#007AFF] text-white",
    totalFirst: true
  },
  paidStars: {
    icon: Star,
    tone: "bg-[#FFB000] text-white"
  },
  scans: {
    icon: ScanLine,
    tone: "bg-[#FF9500] text-white"
  },
  submissions: {
    icon: MessageSquareText,
    tone: "bg-[#34C759] text-white"
  },
  users: {
    icon: UsersRound,
    tone: "bg-[#5856D6] text-white",
    totalFirst: true
  }
};

const sectionMeta: Record<SystemSectionId, { icon: LucideIcon; tone: string }> = {
  organizations: {
    icon: Building2,
    tone: "bg-[#007AFF] text-white"
  },
  stars: {
    icon: CircleDollarSign,
    tone: "bg-[#FFB000] text-white"
  },
  submissions: {
    icon: MessageSquareText,
    tone: "bg-[#34C759] text-white"
  },
  users: {
    icon: UsersRound,
    tone: "bg-[#5856D6] text-white"
  }
};

const submissionFilters = ["ALL", "REVIEW", "COMPLAINT", "SUGGESTION"] as const;

type SubmissionFilter = (typeof submissionFilters)[number];

const SYSTEM_PAGE_SIZE = 24;

const kindMeta: Record<
  SubmissionKindInput,
  {
    icon: LucideIcon;
    labelTone: string;
    tone: string;
  }
> = {
  COMPLAINT: {
    icon: MessageCircleWarning,
    labelTone: "text-danger",
    tone: "bg-[#FF2D55] text-white"
  },
  REVIEW: {
    icon: Star,
    labelTone: "text-warning",
    tone: "bg-[#FFB000] text-white"
  },
  SUGGESTION: {
    icon: Lightbulb,
    labelTone: "text-success",
    tone: "bg-[#34C759] text-white"
  }
};

const RowSuffix = ({ children }: { children?: React.ReactNode }) => (
  <span className="flex min-w-0 items-center gap-2 text-muted">
    {children ? (
      <span className="ios-subhead min-w-0 max-w-[168px] truncate font-medium">{children}</span>
    ) : null}
    <ChevronRight aria-hidden="true" size={17} className="shrink-0 text-muted/84" />
  </span>
);

const SystemIcon = ({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) => (
  <ListIcon className={tone}>
    <Icon size={16} strokeWidth={2.35} />
  </ListIcon>
);

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return "";

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
};

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

  if (dayDiff === 0) return t("admin.feed.date.today");
  if (dayDiff === 1) return t("admin.feed.date.yesterday");

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: "numeric",
    month: "long"
  }).format(date);
};

const getDateKey = (value: string) => {
  const date = new Date(value);

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const formatOwner = (owner: {
  firstName: string;
  lastName: null | string;
  telegramId: string;
  username: null | string;
}) => {
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
  const username = owner.username ? `@${owner.username}` : null;

  return [name || owner.telegramId, username].filter(Boolean).join(" · ");
};

const formatUser = (user: SystemUserItem) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const username = user.username ? `@${user.username}` : null;

  return [name || user.telegramId, username].filter(Boolean).join(" · ");
};

const getUserDisplayName = (user: {
  firstName: string;
  lastName: null | string;
  telegramId: string;
  username: null | string;
}) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

  return name || (user.username ? `@${user.username}` : user.telegramId);
};

const getSubmissionPreview = (
  submission: Pick<SystemSubmissionItem, "bodyText" | "kind">,
  t: (key: string, options?: Record<string, unknown>) => string
) => submission.bodyText.trim() || t(`admin.feed.emptyMessage.${submission.kind}`);

const MetricTile = ({
  id,
  metric,
  period
}: {
  id: SystemMetricId;
  metric: SystemPulseMetric;
  period: SystemPulsePeriod;
}) => {
  const { locale, t } = useI18n();
  const meta = metricMeta[id];
  const Icon = meta.icon;
  const number = React.useMemo(() => new Intl.NumberFormat(getIntlLocale(locale)), [locale]);
  const value = meta.totalFirst || period === "ALL" ? metric.total : metric.value;
  const trendDelta =
    period !== "ALL" && typeof metric.previous === "number" ? metric.value - metric.previous : null;
  const caption =
    period === "ALL"
      ? t("admin.system.metrics.allTime")
      : meta.totalFirst
        ? t("admin.system.metrics.newInPeriod", {
            count: metric.value
          })
        : t("admin.system.metrics.total", {
            count: metric.total
          });

  return (
    <div className="iz-liquid-list rounded-[24px] border px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="ios-title-2 block font-semibold tracking-normal text-foreground">
            {number.format(value)}
          </span>
          <span className="ios-caption-1 mt-0.5 block font-semibold uppercase text-muted">
            {t(`admin.system.metrics.${id}`)}
          </span>
        </span>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-[13px]", meta.tone)}>
          <Icon size={18} strokeWidth={2.35} />
        </span>
      </div>
      <p className="ios-footnote mt-2 truncate text-muted">{caption}</p>
      {trendDelta !== null ? (
        <p
          className={cn(
            "ios-caption-1 mt-0.5 truncate font-medium",
            trendDelta > 0 ? "text-success" : trendDelta < 0 ? "text-danger" : "text-muted"
          )}
        >
          {trendDelta > 0
            ? t("admin.system.metrics.trendUp", {
                count: trendDelta
              })
            : trendDelta < 0
              ? t("admin.system.metrics.trendDown", {
                  count: Math.abs(trendDelta)
                })
              : t("admin.system.metrics.trendFlat")}
        </p>
      ) : null}
    </div>
  );
};

const EmptySection = ({ text }: { text: string }) => (
  <div className="ios-footnote rounded-[24px] border border-dashed border-border/80 px-4 py-5 text-center text-muted">
    {text}
  </div>
);

const SystemHeader = ({ subtitle, title }: { subtitle?: string; title: string }) => (
  <section className="grid gap-1 px-4">
    <h1 className="ios-title-1 font-semibold tracking-normal text-foreground">{title}</h1>
    {subtitle ? <p className="ios-footnote max-w-[380px] text-muted">{subtitle}</p> : null}
  </section>
);

const PeriodTabs = ({
  period,
  setPeriod
}: {
  period: SystemPulsePeriod;
  setPeriod: (period: SystemPulsePeriod) => void;
}) => {
  const { t } = useI18n();

  return (
    <Tabs
      compact
      value={period}
      items={SYSTEM_PULSE_PERIODS.map((item) => ({
        label: t(`admin.system.periods.${item}`),
        value: item
      }))}
      onValueChange={(value) => setPeriod(value as SystemPulsePeriod)}
    />
  );
};

const SystemSearch = ({
  placeholder,
  search,
  setSearch
}: {
  placeholder: string;
  search: string;
  setSearch: (search: string) => void;
}) => {
  const { t } = useI18n();

  return (
    <Input
      addon={{
        before: <Search size={17} strokeWidth={2.35} />
      }}
      clearLabel={t("common.actions.clear")}
      placeholder={placeholder}
      value={search}
      wide
      onChange={(event) => setSearch(event.target.value)}
    />
  );
};

const useLoadMoreRef = ({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage
}: {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}) => {
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = loadMoreRef.current;

    if (!node || !hasNextPage || isFetchingNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          fetchNextPage();
        }
      },
      {
        rootMargin: "520px 0px"
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return loadMoreRef;
};

const useSystemGate = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isLoading, viewer } = useAdminOrganization();

  const goBack = React.useCallback(() => {
    void navigate({ to: "/admin" });
  }, [navigate]);

  useTmaBackButton(true, goBack);

  if (isLoading) {
    return {
      content: (
        <PageTransition>
          <PendingScreen label={t("common.loading")} />
        </PageTransition>
      ),
      isAllowed: false
    };
  }

  if (!viewer.isSystemAdmin) {
    return {
      content: (
        <PageTransition>
          <main className="tma-page bg-surface text-foreground">
            <div className="account-shell">
              <section className="grid justify-items-center gap-2 px-4 text-center">
                <ShieldCheck className="text-muted" size={34} strokeWidth={2.2} />
                <h1 className="ios-title-2 font-semibold tracking-normal">
                  {t("admin.system.accessTitle")}
                </h1>
                <p className="ios-footnote max-w-[340px] text-muted">
                  {t("admin.system.accessHint")}
                </p>
              </section>
            </div>
          </main>
        </PageTransition>
      ),
      isAllowed: false
    };
  }

  return {
    content: null,
    isAllowed: true
  };
};

const useGrantSubscription = () => {
  const queryClient = useQueryClient();
  const tma = useTma();
  const { t } = useI18n();
  const [grantingOrganizationId, setGrantingOrganizationId] = React.useState<string | null>(null);
  const refreshSystemQueries = React.useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["system"]
    });
    await queryClient.invalidateQueries({
      queryKey: ["admin", "organizations"]
    });
  }, [queryClient]);
  const grantMutation = useMutation({
    mutationFn: ({
      organizationId,
      planCode
    }: {
      organizationId: string;
      planCode: SubscriptionPlanCode;
    }) =>
      fetchApiJson(`/api/system/organizations/${organizationId}/subscription/grant`, {
        body: JSON.stringify({
          planCode,
          reason: "System console grant"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        initDataRaw: tma.initDataRaw,
        method: "POST"
      }),
    onError: () => {
      tma.haptics.notification("error");
    },
    onSettled: () => {
      setGrantingOrganizationId(null);
    },
    onSuccess: async () => {
      tma.haptics.notification("success");
      await refreshSystemQueries();
    }
  });
  const cancelMutation = useMutation({
    mutationFn: ({ organizationId }: { organizationId: string }) =>
      fetchApiJson(`/api/system/organizations/${organizationId}/subscription/cancel`, {
        body: JSON.stringify({
          reason: "System console cancel"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        initDataRaw: tma.initDataRaw,
        method: "POST"
      }),
    onError: () => {
      tma.haptics.notification("error");
    },
    onSettled: () => {
      setGrantingOrganizationId(null);
    },
    onSuccess: async () => {
      tma.haptics.notification("success");
      await refreshSystemQueries();
    }
  });
  const pickGrantPlan = React.useCallback(async () => {
    const selected = await showTmaPopup({
      buttons: [
        {
          id: "MONTHLY",
          text: t("admin.system.grantPopup.month"),
          type: "default"
        },
        {
          id: "ANNUAL",
          text: t("admin.system.grantPopup.year"),
          type: "default"
        },
        {
          id: "cancel",
          type: "cancel"
        }
      ],
      message: t("admin.system.grantPopup.message"),
      title: t("admin.system.grantPopup.title")
    });

    return selected === "MONTHLY" || selected === "ANNUAL" ? selected : null;
  }, [t]);
  const grantSubscription = React.useCallback(
    async ({
      isActive,
      organizationId
    }: {
      isActive: boolean;
      organizationId: string;
    }) => {
      if (grantMutation.isPending || cancelMutation.isPending) {
        return;
      }

      tma.haptics.impact("light");
      const action = isActive
        ? await showTmaPopup({
            buttons: [
              {
                id: "grant",
                text: t("admin.system.managePopup.grant"),
                type: "default"
              },
              {
                id: "cancelSubscription",
                text: t("admin.system.managePopup.cancelSubscription"),
                type: "default"
              },
              {
                id: "cancel",
                type: "cancel"
              }
            ],
            message: t("admin.system.managePopup.message"),
            title: t("admin.system.managePopup.title")
          })
        : "grant";

      if (action === "cancelSubscription") {
        const confirmed = await showTmaPopup({
          buttons: [
            {
              id: "confirm",
              text: t("admin.system.cancelPopup.confirm"),
              type: "destructive"
            },
            {
              id: "cancel",
              type: "cancel"
            }
          ],
          message: t("admin.system.cancelPopup.message"),
          title: t("admin.system.cancelPopup.title")
        });

        if (confirmed !== "confirm") {
          return;
        }

        setGrantingOrganizationId(organizationId);
        cancelMutation.mutate({
          organizationId
        });

        return;
      }

      if (action !== "grant") {
        return;
      }

      const planCode = await pickGrantPlan();

      if (!planCode) {
        return;
      }

      setGrantingOrganizationId(organizationId);
      grantMutation.mutate({
        organizationId,
        planCode
      });
    },
    [cancelMutation, grantMutation, pickGrantPlan, t, tma.haptics]
  );

  return {
    grantSubscription,
    grantingOrganizationId,
    isGranting: grantMutation.isPending || cancelMutation.isPending
  };
};

const SystemLoadError = ({ refetch }: { refetch: () => void }) => {
  const { t } = useI18n();

  return (
    <section className="grid justify-items-center gap-3 px-4 text-center">
      <Radar className="text-muted" size={34} strokeWidth={2.2} />
      <h2 className="ios-title-3 font-semibold tracking-normal">
        {t("admin.system.loadErrorTitle")}
      </h2>
      <p className="ios-footnote max-w-[340px] text-muted">{t("admin.system.loadErrorHint")}</p>
      <Button size="sm" onClick={refetch}>
        {t("admin.system.retry")}
      </Button>
    </section>
  );
};

const SystemFeedPill = ({
  children,
  icon: Icon
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
}) => (
  <span className="ios-caption-1 inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-[10px] border border-foreground/[0.06] bg-foreground/[0.045] px-2 font-medium text-muted dark:border-white/[0.06] dark:bg-white/[0.07]">
    {Icon ? <Icon className="shrink-0" size={13} strokeWidth={2.35} /> : null}
    <span className="min-w-0 truncate">{children}</span>
  </span>
);

const SystemSubmissionMediaStrip = ({ submission }: { submission: SystemSubmissionItem }) => {
  if (submission.attachments.length === 0) {
    return null;
  }

  return (
    <div className="scrollbar-hide -mx-0.5 flex gap-1 overflow-x-auto">
      {submission.attachments.map((attachment) => (
        <img
          key={attachment.id}
          src={attachment.publicUrl}
          alt=""
          className="size-20 shrink-0 rounded-[16px] object-cover"
          loading="lazy"
        />
      ))}
    </div>
  );
};

const SystemSubmissionBubble = ({ submission }: { submission: SystemSubmissionItem }) => {
  const { locale, t } = useI18n();
  const meta = kindMeta[submission.kind];
  const Icon = meta.icon;
  const author = submission.customerUser;
  const authorName = author
    ? getUserDisplayName(author)
    : submission.customerDisplayName || t("admin.system.guest");
  const authorMeta = author
    ? [
        author.username ? `@${author.username}` : null,
        t("admin.system.userId", {
          value: author.telegramId
        }),
        author.phoneNumber
      ]
        .filter(Boolean)
        .join(" · ")
    : submission.customerContactPhone || t("admin.system.anonymousGuest");
  const bodyText = submission.bodyText.trim();
  const visibleText = bodyText || getSubmissionPreview(submission, t);
  const bubbleClassName = cn(
    "min-w-0 rounded-[22px] rounded-bl-[7px] border px-3 py-2.5 backdrop-blur-2xl",
    submission.kind === "COMPLAINT"
      ? "border-danger/12 bg-danger/[0.055] dark:border-danger/18 dark:bg-danger/[0.13]"
      : "border-foreground/[0.055] bg-surface-2/82 dark:border-white/[0.07] dark:bg-white/[0.085]"
  );

  return (
    <article className="flex w-full items-end gap-2 px-1">
      {author ? (
        <a
          className="shrink-0 active:opacity-70"
          href={`/admin/system/users/${author.id}`}
          aria-label={authorName}
        >
          <Avatar
            alt={authorName}
            className="size-10 rounded-full"
            initialsClassName="ios-callout"
            name={authorName}
            seed={author.id}
            src={author.photoUrl}
          />
        </a>
      ) : (
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", meta.tone)}>
          <Icon size={18} strokeWidth={2.35} />
        </span>
      )}

      <div className={bubbleClassName}>
        <div className="grid gap-1.5">
          <header className="flex min-w-0 items-start justify-between gap-3 px-1">
            <span className="grid min-w-0 gap-0.5">
              {author ? (
                <a
                  className="ios-footnote min-w-0 truncate font-semibold text-foreground active:opacity-70"
                  href={`/admin/system/users/${author.id}`}
                >
                  {authorName}
                </a>
              ) : (
                <span className="ios-footnote min-w-0 truncate font-semibold text-foreground">
                  {authorName}
                </span>
              )}
              <span className="ios-caption-1 min-w-0 truncate font-medium text-muted">
                {authorMeta}
              </span>
            </span>
            <span className={cn("ios-caption-1 shrink-0 font-semibold", meta.labelTone)}>
              {t(`admin.feed.kind.${submission.kind}`)}
            </span>
          </header>

          <SystemSubmissionMediaStrip submission={submission} />

          <p
            className={cn(
              "ios-body whitespace-pre-wrap px-1 leading-snug",
              bodyText ? "text-foreground" : "text-muted"
            )}
          >
            {visibleText}
          </p>

          <div className="flex min-w-0 flex-wrap gap-1.5 px-1 pt-0.5">
            <a
              className="ios-caption-1 inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-[10px] border border-primary/12 bg-primary/[0.07] px-2 font-medium text-primary active:opacity-70 dark:border-primary/16 dark:bg-primary/[0.14]"
              href={`/admin/system/organizations/${submission.organization.id}`}
            >
              <Building2 className="shrink-0" size={13} strokeWidth={2.35} />
              <span className="min-w-0 truncate">{submission.organization.name}</span>
            </a>
            {submission.qrContext ? (
              <SystemFeedPill icon={MapPin}>{submission.qrContext}</SystemFeedPill>
            ) : null}
            {typeof submission.rating === "number" ? (
              <SystemFeedPill icon={Star}>
                {t("admin.system.rating", {
                  value: submission.rating
                })}
              </SystemFeedPill>
            ) : null}
            {submission.attachments.length > 0 ? (
              <SystemFeedPill icon={ImageIcon}>
                {t("admin.system.photos", {
                  count: submission.attachments.length
                })}
              </SystemFeedPill>
            ) : null}
            {submission.targetStaffMember ? (
              <SystemFeedPill icon={UsersRound}>
                {[submission.targetStaffMember.displayName, submission.targetStaffMember.roleTitle]
                  .filter(Boolean)
                  .join(" · ")}
              </SystemFeedPill>
            ) : null}
          </div>

          <footer className="flex justify-end px-1">
            <span className="ios-caption-1 font-medium text-muted/80">
              {formatDate(submission.createdAt, locale)}
            </span>
          </footer>
        </div>
      </div>
    </article>
  );
};

const SystemSubmissionFeed = ({
  emptyText,
  loadMoreRef,
  submissions
}: {
  emptyText: string;
  loadMoreRef?: React.RefObject<HTMLDivElement | null>;
  submissions: SystemSubmissionItem[];
}) => {
  const { locale, t } = useI18n();
  const rows = submissions.map((submission, index) => {
    const previousSubmission = submissions[index - 1];
    const dateKey = getDateKey(submission.createdAt);
    const showDateSeparator =
      !previousSubmission || getDateKey(previousSubmission.createdAt) !== dateKey;

    return {
      dateLabel: showDateSeparator ? formatDateSeparator(submission.createdAt, locale, t) : null,
      submission
    };
  });

  if (submissions.length === 0) {
    return <EmptySection text={emptyText} />;
  }

  return (
    <div className="grid gap-3">
      {rows.map(({ dateLabel, submission }) => (
        <React.Fragment key={submission.id}>
          {dateLabel ? (
            <div className="ios-caption-1 justify-self-center rounded-full bg-foreground/[0.055] px-3 py-1 font-semibold text-muted dark:bg-white/[0.07]">
              {dateLabel}
            </div>
          ) : null}
          <SystemSubmissionBubble submission={submission} />
        </React.Fragment>
      ))}
      {loadMoreRef ? <div ref={loadMoreRef} aria-hidden="true" className="h-1" /> : null}
    </div>
  );
};

export const AdminSystemPage = () => {
  const gate = useSystemGate();
  const tma = useTma();
  const { locale, t } = useI18n();
  const [period, setPeriod] = React.useState<SystemPulsePeriod>("7D");
  const number = React.useMemo(() => new Intl.NumberFormat(getIntlLocale(locale)), [locale]);
  const pulseQuery = useQuery({
    enabled: gate.isAllowed && tma.isReady && Boolean(tma.initDataRaw),
    queryFn: () =>
      fetchApiJson<SystemPulsePayload>(`/api/system/pulse?period=${period}`, {
        initDataRaw: tma.initDataRaw
      }),
    queryKey: queryKeys.systemPulse(period, tma.initDataRaw)
  });
  const pulse = pulseQuery.data ?? null;
  const conversion =
    pulse && pulse.totals.scans.value > 0
      ? Math.round((pulse.totals.submissions.value / pulse.totals.scans.value) * 100)
      : null;

  if (!gate.isAllowed) {
    return gate.content;
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <SystemHeader title={t("admin.system.title")} subtitle={t("admin.system.subtitle")} />

          <section className="grid gap-3">
            <PeriodTabs period={period} setPeriod={setPeriod} />
          </section>

          {pulseQuery.isLoading && !pulse ? (
            <PendingScreen label={t("common.loading")} />
          ) : pulseQuery.isError ? (
            <SystemLoadError refetch={() => void pulseQuery.refetch()} />
          ) : pulse ? (
            <>
              <section className="grid grid-cols-2 gap-2 px-1">
                {(
                  [
                    "submissions",
                    "scans",
                    "users",
                    "organizations",
                    "paidStars",
                    "activeSubscriptions"
                  ] as const
                ).map((id) => (
                  <MetricTile key={id} id={id} metric={pulse.totals[id]} period={period} />
                ))}
              </section>

              {conversion !== null ? (
                <section className="px-1">
                  <div className="iz-liquid-list rounded-[24px] border px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="min-w-0">
                        <span className="ios-body block font-medium">
                          {t("admin.system.conversionTitle")}
                        </span>
                        <span className="ios-footnote text-muted">
                          {t("admin.system.conversionHint")}
                        </span>
                      </span>
                      <span className="ios-title-2 shrink-0 font-semibold tracking-normal">
                        {conversion}%
                      </span>
                    </div>
                  </div>
                </section>
              ) : null}

              <List
                title={t("admin.system.sections.hub")}
                items={(
                  [
                    {
                      id: "organizations",
                      suffix: number.format(pulse.totals.organizations.total),
                      to: "/admin/system/organizations"
                    },
                    {
                      id: "users",
                      suffix: number.format(pulse.totals.users.total),
                      to: "/admin/system/users"
                    },
                    {
                      id: "submissions",
                      suffix: number.format(pulse.totals.submissions.value),
                      to: "/admin/system/submissions"
                    },
                    {
                      id: "stars",
                      suffix: number.format(pulse.totals.paidStars.value),
                      to: "/admin/system/stars"
                    }
                  ] as const
                ).map((item) => {
                  const meta = sectionMeta[item.id];

                  return {
                    addon: {
                      after: <RowSuffix>{item.suffix}</RowSuffix>,
                      before: <SystemIcon icon={meta.icon} tone={meta.tone} />
                    },
                    href: item.to,
                    title: t(`admin.system.sections.${item.id}`)
                  };
                })}
              />

              <section className="grid gap-2.5">
                <h2 className="ios-caption-1 px-4 font-semibold uppercase text-muted">
                  {t("admin.system.sections.recentSubmissions")}
                </h2>
                <SystemSubmissionFeed
                  emptyText={t("admin.system.emptySubmissions")}
                  submissions={pulse.recentSubmissions.map((submission) => ({
                    ...submission,
                    attachments: [],
                    bodyText: submission.preview,
                    customerAllowsReply: false,
                    customerContactPhone: null,
                    customerDisplayName: null,
                    locale: "ru",
                    metadata: {},
                    targetStaffMember: null
                  }))}
                />
              </section>
            </>
          ) : null}
        </div>
      </main>
    </PageTransition>
  );
};

export const AdminSystemOrganizationsPage = () => {
  const gate = useSystemGate();
  const tma = useTma();
  const { locale, t } = useI18n();
  const [period, setPeriod] = React.useState<SystemPulsePeriod>("7D");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());
  const number = React.useMemo(() => new Intl.NumberFormat(getIntlLocale(locale)), [locale]);
  const organizationsQuery = useInfiniteQuery({
    enabled: gate.isAllowed && tma.isReady && Boolean(tma.initDataRaw),
    getNextPageParam: (lastPage: SystemOrganizationsPayload) => lastPage.nextCursor,
    initialPageParam: null as null | string,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(SYSTEM_PAGE_SIZE),
        period,
        search: deferredSearch
      });

      if (pageParam) {
        params.set("cursor", pageParam);
      }

      return fetchApiJson<SystemOrganizationsPayload>(
        `/api/system/organizations?${params.toString()}`,
        {
          initDataRaw: tma.initDataRaw
        }
      );
    },
    queryKey: queryKeys.systemOrganizations(period, deferredSearch, tma.initDataRaw)
  });
  const firstPage = organizationsQuery.data?.pages[0] ?? null;
  const organizations = organizationsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const loadMoreRef = useLoadMoreRef({
    fetchNextPage: () => {
      void organizationsQuery.fetchNextPage();
    },
    hasNextPage: Boolean(organizationsQuery.hasNextPage),
    isFetchingNextPage: organizationsQuery.isFetchingNextPage
  });

  if (!gate.isAllowed) return gate.content;

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <SystemHeader
            title={t("admin.system.sections.organizations")}
            subtitle={t("admin.system.pages.organizationsHint")}
          />
          <section className="grid gap-3">
            <SystemSearch
              placeholder={t("admin.system.search.organizations")}
              search={search}
              setSearch={setSearch}
            />
            <PeriodTabs period={period} setPeriod={setPeriod} />
          </section>

          {organizationsQuery.isPending && !firstPage ? (
            <PendingScreen label={t("common.loading")} />
          ) : organizationsQuery.isError && !firstPage ? (
            <SystemLoadError refetch={() => void organizationsQuery.refetch()} />
          ) : organizations.length > 0 ? (
            <>
              <List
                hint={t("admin.system.pages.organizationsCount", {
                  count: firstPage?.total ?? organizations.length
                })}
                separatorInsetClassName="ml-[76px]"
                spacing="md"
                items={organizations.map((organization) => ({
                  addon: {
                    after: (
                      <RowSuffix>
                        {number.format(organization.scanCount)} /{" "}
                        {number.format(organization.submissionCount)}
                      </RowSuffix>
                    ),
                    before: (
                      <Avatar
                        alt={organization.name}
                        className="size-11 rounded-full"
                        initialsClassName="ios-callout"
                        name={organization.name}
                        seed={organization.id}
                        src={organization.logoUrl}
                      />
                    )
                  },
                  href: `/admin/system/organizations/${organization.id}`,
                  subtitle: formatOwner(organization.owner),
                  title: organization.name
                }))}
              />
              {organizationsQuery.hasNextPage ? (
                <div ref={loadMoreRef} aria-hidden="true" className="h-1" />
              ) : null}
            </>
          ) : (
            <EmptySection text={t("admin.system.emptyOrganizations")} />
          )}
        </div>
      </main>
    </PageTransition>
  );
};

export const AdminSystemOrganizationPage = () => {
  const params = useParams({ from: "/admin/system/organizations/$organizationId" });
  const gate = useSystemGate();
  const tma = useTma();
  const { locale, t } = useI18n();
  const [period, setPeriod] = React.useState<SystemPulsePeriod>("7D");
  const number = React.useMemo(() => new Intl.NumberFormat(getIntlLocale(locale)), [locale]);
  const { grantSubscription, grantingOrganizationId, isGranting } = useGrantSubscription();
  const detailQuery = useInfiniteQuery({
    enabled: gate.isAllowed && tma.isReady && Boolean(tma.initDataRaw),
    getNextPageParam: (lastPage: SystemOrganizationDetailPayload) =>
      lastPage.submissionsNextCursor,
    initialPageParam: null as null | string,
    queryFn: ({ pageParam }) => {
      const queryParams = new URLSearchParams({
        limit: String(SYSTEM_PAGE_SIZE),
        period
      });

      if (pageParam) {
        queryParams.set("cursor", pageParam);
      }

      return fetchApiJson<SystemOrganizationDetailPayload>(
        `/api/system/organizations/${params.organizationId}?${queryParams.toString()}`,
        {
          initDataRaw: tma.initDataRaw
        }
      );
    },
    queryKey: queryKeys.systemOrganizationDetail(params.organizationId, period, tma.initDataRaw)
  });
  const detail = detailQuery.data?.pages[0] ?? null;
  const auditLogs = detail?.auditLogs ?? [];
  const submissions = detailQuery.data?.pages.flatMap((page) => page.submissions) ?? [];
  const organization = detail?.organization ?? null;
  const loadMoreRef = useLoadMoreRef({
    fetchNextPage: () => {
      void detailQuery.fetchNextPage();
    },
    hasNextPage: Boolean(detailQuery.hasNextPage),
    isFetchingNextPage: detailQuery.isFetchingNextPage
  });

  if (!gate.isAllowed) return gate.content;

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          {detailQuery.isPending && !detail ? (
            <PendingScreen label={t("common.loading")} />
          ) : detailQuery.isError || !organization ? (
            <SystemLoadError refetch={() => void detailQuery.refetch()} />
          ) : (
            <>
              <section className="grid justify-items-center gap-3 px-4 text-center">
                <Avatar
                  alt={organization.name}
                  className="size-[96px] rounded-full"
                  initialsClassName="ios-title-1"
                  name={organization.name}
                  seed={organization.id}
                  src={organization.logoUrl}
                />
                <div className="grid gap-1">
                  <h1 className="ios-title-1 font-semibold tracking-normal text-foreground">
                    {organization.name}
                  </h1>
                  <p className="ios-footnote text-muted">{formatOwner(organization.owner)}</p>
                </div>
              </section>

              <section className="grid gap-3">
                <PeriodTabs period={period} setPeriod={setPeriod} />
              </section>

              <section className="grid grid-cols-2 gap-2 px-1">
                <MetricTile
                  id="scans"
                  metric={{ total: organization.scanCount, value: organization.scanCount }}
                  period={period}
                />
                <MetricTile
                  id="submissions"
                  metric={{
                    total: organization.submissionCount,
                    value: organization.submissionCount
                  }}
                  period={period}
                />
              </section>

              <List
                items={[
                  {
                    addon: {
                      after: (
                        <Button
                          disabled={isGranting}
                          size="xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            void grantSubscription({
                              isActive: organization.subscription.isActive,
                              organizationId: organization.id
                            });
                          }}
                        >
                          {grantingOrganizationId === organization.id
                            ? t("admin.system.granting")
                            : t(
                                `admin.system.${organization.subscription.isActive ? "manageAction" : "grantAction"}`
                              )}
                        </Button>
                      ),
                      before: <SystemIcon icon={Gift} tone="bg-[#30B0C7] text-white" />
                    },
                    isAction: false,
                    subtitle: organization.subscription.currentPeriodEndsAt
                      ? t("admin.system.subscriptionUntil", {
                          date: formatDate(organization.subscription.currentPeriodEndsAt, locale)
                        })
                      : undefined,
                    title: t("admin.rows.subscription")
                  }
                ]}
              />

              <section className="grid gap-2.5">
                <h2 className="ios-caption-1 px-4 font-semibold uppercase text-muted">
                  {t("admin.system.sections.submissions")}
                </h2>
                <SystemSubmissionFeed
                  emptyText={t("admin.system.emptySubmissions")}
                  loadMoreRef={detailQuery.hasNextPage ? loadMoreRef : undefined}
                  submissions={submissions}
                />
              </section>

              {auditLogs.length > 0 ? (
                <List
                  title={t("admin.system.sections.auditLog")}
                  items={auditLogs.map((item) => ({
                    addon: {
                      after: <RowSuffix>{formatDate(item.createdAt, locale)}</RowSuffix>,
                      before: <SystemIcon icon={ShieldCheck} tone="bg-[#5856D6] text-white" />
                    },
                    subtitle: item.actor
                      ? formatOwner(item.actor)
                      : t("admin.system.audit.systemActor"),
                    title: t(`admin.system.audit.${item.action}`, {
                      defaultValue: item.action
                    })
                  }))}
                />
              ) : null}
            </>
          )}
        </div>
      </main>
    </PageTransition>
  );
};

export const AdminSystemUsersPage = () => {
  const gate = useSystemGate();
  const tma = useTma();
  const { locale, t } = useI18n();
  const [period, setPeriod] = React.useState<SystemPulsePeriod>("7D");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());
  const number = React.useMemo(() => new Intl.NumberFormat(getIntlLocale(locale)), [locale]);
  const usersQuery = useInfiniteQuery({
    enabled: gate.isAllowed && tma.isReady && Boolean(tma.initDataRaw),
    getNextPageParam: (lastPage: SystemUsersPayload) => lastPage.nextCursor,
    initialPageParam: null as null | string,
    queryFn: ({ pageParam }) => {
      const queryParams = new URLSearchParams({
        limit: String(SYSTEM_PAGE_SIZE),
        period,
        search: deferredSearch
      });

      if (pageParam) {
        queryParams.set("cursor", pageParam);
      }

      return fetchApiJson<SystemUsersPayload>(`/api/system/users?${queryParams.toString()}`, {
        initDataRaw: tma.initDataRaw
      });
    },
    queryKey: queryKeys.systemUsers(period, deferredSearch, tma.initDataRaw)
  });
  const firstPage = usersQuery.data?.pages[0] ?? null;
  const users = usersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const loadMoreRef = useLoadMoreRef({
    fetchNextPage: () => {
      void usersQuery.fetchNextPage();
    },
    hasNextPage: Boolean(usersQuery.hasNextPage),
    isFetchingNextPage: usersQuery.isFetchingNextPage
  });

  if (!gate.isAllowed) return gate.content;

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <SystemHeader
            title={t("admin.system.sections.users")}
            subtitle={t("admin.system.pages.usersHint")}
          />
          <section className="grid gap-3">
            <SystemSearch
              placeholder={t("admin.system.search.users")}
              search={search}
              setSearch={setSearch}
            />
            <PeriodTabs period={period} setPeriod={setPeriod} />
          </section>

          {usersQuery.isPending && !firstPage ? (
            <PendingScreen label={t("common.loading")} />
          ) : usersQuery.isError && !firstPage ? (
            <SystemLoadError refetch={() => void usersQuery.refetch()} />
          ) : users.length > 0 ? (
            <>
              <List
                hint={t("admin.system.pages.usersCount", {
                  count: firstPage?.total ?? users.length
                })}
                separatorInsetClassName="ml-[76px]"
                spacing="md"
                items={users.map((user) => ({
                  addon: {
                    after: (
                      <RowSuffix>
                        {number.format(user.submissionCount)} / {number.format(user.scanCount)}
                      </RowSuffix>
                    ),
                    before: (
                      <Avatar
                        alt={formatUser(user)}
                        className="size-11 rounded-full"
                        initialsClassName="ios-callout"
                        name={formatUser(user)}
                        seed={user.id}
                        src={user.photoUrl}
                      />
                    )
                  },
                  href: `/admin/system/users/${user.id}`,
                  subtitle: [
                    user.phoneNumber,
                    t("admin.system.userMeta", {
                      locale: user.locale,
                      telegramId: user.telegramId
                    })
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  title: formatUser(user)
                }))}
              />
              {usersQuery.hasNextPage ? (
                <div ref={loadMoreRef} aria-hidden="true" className="h-1" />
              ) : null}
            </>
          ) : (
            <EmptySection text={t("admin.system.emptyUsers")} />
          )}
        </div>
      </main>
    </PageTransition>
  );
};

export const AdminSystemUserPage = () => {
  const params = useParams({ from: "/admin/system/users/$userId" });
  const gate = useSystemGate();
  const tma = useTma();
  const { locale, t } = useI18n();
  const number = React.useMemo(() => new Intl.NumberFormat(getIntlLocale(locale)), [locale]);
  const userQuery = useInfiniteQuery({
    enabled: gate.isAllowed && tma.isReady && Boolean(tma.initDataRaw),
    getNextPageParam: (lastPage: SystemUserDetailPayload) => lastPage.submissionsNextCursor,
    initialPageParam: null as null | string,
    queryFn: ({ pageParam }) => {
      const queryParams = new URLSearchParams({
        limit: String(SYSTEM_PAGE_SIZE)
      });

      if (pageParam) {
        queryParams.set("cursor", pageParam);
      }

      return fetchApiJson<SystemUserDetailPayload>(
        `/api/system/users/${params.userId}?${queryParams.toString()}`,
        {
          initDataRaw: tma.initDataRaw
        }
      );
    },
    queryKey: queryKeys.systemUserDetail(params.userId, tma.initDataRaw)
  });
  const detail = userQuery.data?.pages[0] ?? null;
  const user = detail?.user ?? null;
  const submissions = userQuery.data?.pages.flatMap((page) => page.submissions) ?? [];
  const loadMoreRef = useLoadMoreRef({
    fetchNextPage: () => {
      void userQuery.fetchNextPage();
    },
    hasNextPage: Boolean(userQuery.hasNextPage),
    isFetchingNextPage: userQuery.isFetchingNextPage
  });

  if (!gate.isAllowed) return gate.content;

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          {userQuery.isPending && !detail ? (
            <PendingScreen label={t("common.loading")} />
          ) : userQuery.isError || !detail || !user ? (
            <SystemLoadError refetch={() => void userQuery.refetch()} />
          ) : (
            <>
              <section className="grid justify-items-center gap-3 px-4 text-center">
                <Avatar
                  alt={formatUser(user)}
                  className="size-[96px] rounded-full"
                  initialsClassName="ios-title-1"
                  name={formatUser(user)}
                  seed={user.id}
                  src={user.photoUrl}
                />
                <div className="grid gap-1">
                  <h1 className="ios-title-1 font-semibold tracking-normal text-foreground">
                    {getUserDisplayName(user)}
                  </h1>
                  <p className="ios-footnote text-muted">
                    {[user.username ? `@${user.username}` : null, user.phoneNumber]
                      .filter(Boolean)
                      .join(" · ") ||
                      t("admin.system.userMeta", {
                        locale: user.locale,
                        telegramId: user.telegramId
                      })}
                  </p>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-2 px-1">
                <MetricTile
                  id="submissions"
                  metric={{ total: user.submissionCount, value: user.submissionCount }}
                  period="ALL"
                />
                <MetricTile
                  id="scans"
                  metric={{ total: user.scanCount, value: user.scanCount }}
                  period="ALL"
                />
                <MetricTile
                  id="organizations"
                  metric={{ total: user.organizationCount, value: user.organizationCount }}
                  period="ALL"
                />
              </section>

              <List
                title={t("admin.system.sections.userInfo")}
                items={[
                  {
                    addon: {
                      before: <SystemIcon icon={UsersRound} tone="bg-[#5856D6] text-white" />
                    },
                    subtitle: t("admin.system.userMeta", {
                      locale: user.locale,
                      telegramId: user.telegramId
                    }),
                    title: t("admin.system.userTelegram")
                  },
                  ...(user.languageCode
                    ? [
                        {
                          addon: {
                            before: (
                              <SystemIcon icon={ShieldCheck} tone="bg-[#30B0C7] text-white" />
                            )
                          },
                          subtitle: user.locale,
                          title: t("admin.system.userLanguage", {
                            value: user.languageCode
                          })
                        }
                      ]
                    : [])
                ]}
              />

              {detail.organizations.length > 0 ? (
                <List
                  title={t("admin.system.sections.userOrganizations")}
                  separatorInsetClassName="ml-[76px]"
                  spacing="md"
                  items={detail.organizations.map((organization) => ({
                    addon: {
                      after: (
                        <RowSuffix>
                          {number.format(organization.scanCount)} /{" "}
                          {number.format(organization.submissionCount)}
                        </RowSuffix>
                      ),
                      before: (
                        <Avatar
                          alt={organization.name}
                          className="size-11 rounded-full"
                          initialsClassName="ios-callout"
                          name={organization.name}
                          seed={organization.id}
                          src={organization.logoUrl}
                        />
                      )
                    },
                    href: `/admin/system/organizations/${organization.id}`,
                    subtitle: organization.slug,
                    title: organization.name
                  }))}
                />
              ) : null}

              <section className="grid gap-2.5">
                <h2 className="ios-caption-1 px-4 font-semibold uppercase text-muted">
                  {t("admin.system.sections.userSubmissions")}
                </h2>
                <SystemSubmissionFeed
                  emptyText={t("admin.system.emptySubmissions")}
                  loadMoreRef={userQuery.hasNextPage ? loadMoreRef : undefined}
                  submissions={submissions}
                />
              </section>

              {detail.stars.length > 0 ? (
                <List
                  title={t("admin.system.sections.starsPayments")}
                  items={detail.stars.map((payment) => ({
                    addon: {
                      after: (
                        <span className="ios-subhead font-semibold text-foreground">
                          {number.format(payment.amountStars)}
                        </span>
                      ),
                      before: (
                        <SystemIcon icon={CircleDollarSign} tone="bg-[#FFB000] text-white" />
                      )
                    },
                    href: `/admin/system/organizations/${payment.organization.id}`,
                    subtitle: [
                      payment.organization.name,
                      formatDate(payment.paidAt ?? payment.createdAt, locale)
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    title: t(`admin.system.paymentStatus.${payment.status}`)
                  }))}
                />
              ) : null}

              {detail.auditLogs.length > 0 ? (
                <List
                  title={t("admin.system.sections.auditLog")}
                  items={detail.auditLogs.map((item) => ({
                    addon: {
                      after: <RowSuffix>{formatDate(item.createdAt, locale)}</RowSuffix>,
                      before: <SystemIcon icon={ShieldCheck} tone="bg-[#5856D6] text-white" />
                    },
                    subtitle: item.actor
                      ? formatOwner(item.actor)
                      : t("admin.system.audit.systemActor"),
                    title: t(`admin.system.audit.${item.action}`, {
                      defaultValue: item.action
                    })
                  }))}
                />
              ) : null}
            </>
          )}
        </div>
      </main>
    </PageTransition>
  );
};

export const AdminSystemSubmissionsPage = () => {
  const gate = useSystemGate();
  const tma = useTma();
  const { t } = useI18n();
  const [period, setPeriod] = React.useState<SystemPulsePeriod>("7D");
  const [filter, setFilter] = React.useState<SubmissionFilter>("ALL");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());
  const submissionsQuery = useInfiniteQuery({
    enabled: gate.isAllowed && tma.isReady && Boolean(tma.initDataRaw),
    getNextPageParam: (lastPage: SystemSubmissionsPayload) => lastPage.nextCursor,
    initialPageParam: null as null | string,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(SYSTEM_PAGE_SIZE),
        period,
        search: deferredSearch
      });

      if (filter !== "ALL") {
        params.set("kind", filter);
      }

      if (pageParam) {
        params.set("cursor", pageParam);
      }

      return fetchApiJson<SystemSubmissionsPayload>(`/api/system/submissions?${params}`, {
        initDataRaw: tma.initDataRaw
      });
    },
    queryKey: queryKeys.systemSubmissions(period, deferredSearch, filter, tma.initDataRaw)
  });
  const firstPage = submissionsQuery.data?.pages[0] ?? null;
  const submissions = submissionsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const loadMoreRef = useLoadMoreRef({
    fetchNextPage: () => {
      void submissionsQuery.fetchNextPage();
    },
    hasNextPage: Boolean(submissionsQuery.hasNextPage),
    isFetchingNextPage: submissionsQuery.isFetchingNextPage
  });

  if (!gate.isAllowed) return gate.content;

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <SystemHeader
            title={t("admin.system.sections.submissions")}
            subtitle={t("admin.system.pages.submissionsHint")}
          />
          <section className="grid gap-3">
            <SystemSearch
              placeholder={t("admin.system.search.submissions")}
              search={search}
              setSearch={setSearch}
            />
            <PeriodTabs period={period} setPeriod={setPeriod} />
            <Tabs
              compact
              value={filter}
              items={submissionFilters.map((item) => ({
                label: t(`admin.feed.filters.${item}`),
                value: item
              }))}
              onValueChange={(value) => setFilter(value as SubmissionFilter)}
            />
          </section>

          {submissionsQuery.isPending && !firstPage ? (
            <PendingScreen label={t("common.loading")} />
          ) : submissionsQuery.isError && !firstPage ? (
            <SystemLoadError refetch={() => void submissionsQuery.refetch()} />
          ) : (
            <SystemSubmissionFeed
              emptyText={t("admin.system.emptySubmissions")}
              loadMoreRef={submissionsQuery.hasNextPage ? loadMoreRef : undefined}
              submissions={submissions}
            />
          )}
        </div>
      </main>
    </PageTransition>
  );
};

export const AdminSystemStarsPage = () => {
  const gate = useSystemGate();
  const tma = useTma();
  const { locale, t } = useI18n();
  const [period, setPeriod] = React.useState<SystemPulsePeriod>("7D");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());
  const number = React.useMemo(() => new Intl.NumberFormat(getIntlLocale(locale)), [locale]);
  const starsQuery = useInfiniteQuery({
    enabled: gate.isAllowed && tma.isReady && Boolean(tma.initDataRaw),
    getNextPageParam: (lastPage: SystemStarsPayload) => lastPage.nextCursor,
    initialPageParam: null as null | string,
    queryFn: ({ pageParam }) => {
      const queryParams = new URLSearchParams({
        limit: String(SYSTEM_PAGE_SIZE),
        period,
        search: deferredSearch
      });

      if (pageParam) {
        queryParams.set("cursor", pageParam);
      }

      return fetchApiJson<SystemStarsPayload>(`/api/system/stars?${queryParams.toString()}`, {
        initDataRaw: tma.initDataRaw
      });
    },
    queryKey: queryKeys.systemStars(period, deferredSearch, tma.initDataRaw)
  });
  const stars = starsQuery.data?.pages[0] ?? null;
  const payments = starsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const loadMoreRef = useLoadMoreRef({
    fetchNextPage: () => {
      void starsQuery.fetchNextPage();
    },
    hasNextPage: Boolean(starsQuery.hasNextPage),
    isFetchingNextPage: starsQuery.isFetchingNextPage
  });

  if (!gate.isAllowed) return gate.content;

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <SystemHeader
            title={t("admin.system.sections.stars")}
            subtitle={t("admin.system.pages.starsHint")}
          />
          <section className="grid gap-3">
            <SystemSearch
              placeholder={t("admin.system.search.stars")}
              search={search}
              setSearch={setSearch}
            />
            <PeriodTabs period={period} setPeriod={setPeriod} />
          </section>

          {starsQuery.isPending && !stars ? (
            <PendingScreen label={t("common.loading")} />
          ) : starsQuery.isError || !stars ? (
            <SystemLoadError refetch={() => void starsQuery.refetch()} />
          ) : (
            <>
              <section className="grid grid-cols-2 gap-2 px-1">
                <MetricTile
                  id="paidStars"
                  metric={{ total: stars.totals.paidStars, value: stars.totals.paidStars }}
                  period={period}
                />
                <MetricTile
                  id="activeSubscriptions"
                  metric={{ total: stars.totals.paidPayments, value: stars.totals.paidPayments }}
                  period={period}
                />
              </section>

              {payments.length > 0 ? (
                <>
                  <List
                    title={t("admin.system.sections.starsPayments")}
                    items={payments.map((payment) => ({
                      addon: {
                        after: (
                          <span className="ios-subhead font-semibold text-foreground">
                            {number.format(payment.amountStars)}
                          </span>
                        ),
                        before: (
                          <SystemIcon icon={CircleDollarSign} tone="bg-[#FFB000] text-white" />
                        )
                      },
                      href: `/admin/system/organizations/${payment.organization.id}`,
                      subtitle: [
                        payment.organization.name,
                        payment.payer ? formatOwner(payment.payer) : null,
                        formatDate(payment.paidAt ?? payment.createdAt, locale)
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      title: t(`admin.system.paymentStatus.${payment.status}`)
                    }))}
                  />
                  {starsQuery.hasNextPage ? (
                    <div ref={loadMoreRef} aria-hidden="true" className="h-1" />
                  ) : null}
                </>
              ) : (
                <EmptySection text={t("admin.system.emptyStars")} />
              )}
            </>
          )}
        </div>
      </main>
    </PageTransition>
  );
};
