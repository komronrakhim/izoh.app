import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Lightbulb,
  MapPin,
  MessageCircleWarning,
  MessageSquareText,
  RefreshCw,
  SmilePlus,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  UserRound,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import * as React from "react";

import { Button, ListIcon, PendingScreen } from "~/common/ui";
import { cn } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import { useAdminOrganization } from "~/shared/admin";
import {
  ADMIN_ANALYTICS_PERIODS,
  type AdminAnalyticsBreakdownItem,
  type AdminAnalyticsPayload,
  type AdminAnalyticsPeriod,
  type AdminAnalyticsStaffItem
} from "~/shared/analytics";
import { useI18n } from "~/shared/i18n/react";
import { queryKeys } from "~/shared/query";
import { getRatingEmoji, getRatingLabelKey } from "~/shared/ratings";
import { PageTransition } from "~/shared/router/page-transition";
import { useTma, useTmaBackButton } from "~/shared/tma";

type AnalyticsTab = "contexts" | "mood" | "overview" | "team" | "time" | "topics";

const baseTabs = ["overview", "mood", "topics", "contexts", "time"] as const satisfies Readonly<
  Exclude<AnalyticsTab, "team">[]
>;

const tabIconMap = {
  contexts: MapPin,
  mood: SmilePlus,
  overview: BarChart3,
  team: UsersRound,
  time: Clock3,
  topics: MessageSquareText
} as const satisfies Record<AnalyticsTab, LucideIcon>;

const metricToneClassNames = {
  blue: "bg-[#2AABEE]",
  green: "bg-[#34C759]",
  orange: "bg-[#FF9500]",
  pink: "bg-[#FF2D55]",
  purple: "bg-[#AF52DE]",
  teal: "bg-[#00C7BE]",
  yellow: "bg-[#FFB000]"
} as const;

type MetricTone = keyof typeof metricToneClassNames;

const formatNumber = (value: number, locale: string) =>
  new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : "ru-RU").format(value);

const formatPercent = (value: number) => `${Math.round(value)}%`;

const getPercent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

const formatDate = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
    day: "numeric",
    month: "short"
  }).format(new Date(`${value}T12:00:00`));

const formatHour = (hour: number) => String(hour).padStart(2, "0") + ":00";

const getWeekdayName = (day: number, locale: string) =>
  new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
    weekday: "short"
  }).format(new Date(Date.UTC(2026, 5, 7 + day)));

const getTrendText = (
  analytics: AdminAnalyticsPayload,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const diff = analytics.totals.trend.current - analytics.totals.trend.previous;

  if (diff === 0) {
    return t("admin.analytics.trend.flat");
  }

  return t(diff > 0 ? "admin.analytics.trend.up" : "admin.analytics.trend.down", {
    count: Math.abs(diff)
  });
};

const getTopicTitle = (
  kind: "complaint" | "suggestion",
  id: string,
  t: (key: string, options?: Record<string, unknown>) => string
) => t(`customer.topicOptions.${kind}.${id}`);

const MetricIcon = ({ icon: Icon, tone }: { icon: LucideIcon; tone: MetricTone }) => (
  <ListIcon className={cn(metricToneClassNames[tone], "text-white")}>
    <Icon size={15.5} strokeWidth={2.35} />
  </ListIcon>
);

const AnalyticsPanel = ({
  children,
  className,
  title
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
}) => (
  <section className="grid gap-2.5">
    {title ? (
      <h3 className="ios-caption-1 px-4 font-semibold uppercase text-muted">{title}</h3>
    ) : null}
    <div className={cn("iz-liquid-list rounded-[28px] border border-transparent p-4", className)}>
      {children}
    </div>
  </section>
);

const StatGrid = ({
  items
}: {
  items: Array<{
    icon: LucideIcon;
    label: string;
    tone: MetricTone;
    value: React.ReactNode;
  }>;
}) => (
  <div className="grid grid-cols-2 gap-2.5">
    {items.map((item) => (
      <div
        key={item.label}
        className="grid min-h-[112px] content-between rounded-[22px] bg-foreground/[0.045] p-3.5 dark:bg-white/[0.06]"
      >
        <div className="flex items-center justify-between gap-2">
          <MetricIcon icon={item.icon} tone={item.tone} />
        </div>
        <div className="grid gap-1">
          <div className="ios-title-2 font-semibold text-foreground">{item.value}</div>
          <div className="ios-caption-1 font-medium text-muted">{item.label}</div>
        </div>
      </div>
    ))}
  </div>
);

const ProgressRow = ({
  label,
  meta,
  percent,
  tone = "blue",
  value
}: {
  label: React.ReactNode;
  meta?: React.ReactNode;
  percent: number;
  tone?: MetricTone;
  value: React.ReactNode;
}) => (
  <div className="grid gap-2">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="ios-body truncate text-foreground">{label}</div>
        {meta ? <div className="ios-caption-1 mt-0.5 text-muted">{meta}</div> : null}
      </div>
      <div className="ios-subhead shrink-0 font-medium text-muted">{value}</div>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.075] dark:bg-white/[0.09]">
      <div
        className={cn("h-full rounded-full", metricToneClassNames[tone])}
        style={{
          width: percent > 0 ? `${Math.max(4, Math.min(100, percent))}%` : "0%"
        }}
      />
    </div>
  </div>
);

const EmptyBlock = ({ text }: { text: string }) => (
  <div className="grid min-h-[160px] place-items-center px-5 py-8 text-center">
    <p className="ios-footnote max-w-[280px] text-muted">{text}</p>
  </div>
);

const OverviewTab = ({
  analytics,
  locale,
  t
}: {
  analytics: AdminAnalyticsPayload;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  const total = analytics.totals.counts.ALL;
  const topComplaintTopic = analytics.topics.complaint[0];
  const topSuggestionTopic = analytics.topics.suggestion[0];
  const topStaff = analytics.staff.items[0];
  const topContext = analytics.contexts[0];
  const insights = [
    total > 0
      ? t("admin.analytics.insights.total", {
          count: total
        })
      : t("admin.analytics.insights.empty"),
    topComplaintTopic
      ? t("admin.analytics.insights.complaintTopic", {
          topic: getTopicTitle("complaint", topComplaintTopic.id, t)
        })
      : null,
    topSuggestionTopic
      ? t("admin.analytics.insights.suggestionTopic", {
          topic: getTopicTitle("suggestion", topSuggestionTopic.id, t)
        })
      : null,
    analytics.staff.enabled && topStaff?.thanksCount
      ? t("admin.analytics.insights.staff", {
          name: topStaff.displayName
        })
      : null,
    topContext
      ? t("admin.analytics.insights.context", {
          context: topContext.label
        })
      : null
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-5">
      <AnalyticsPanel>
        <div className="grid gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <p className="ios-caption-1 font-semibold uppercase text-muted">
                {t("admin.analytics.overview.total")}
              </p>
              <h3 className="ios-large-title font-semibold tracking-normal text-foreground">
                {formatNumber(total, locale)}
              </h3>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ios-footnote font-semibold",
                analytics.totals.trend.direction === "up"
                  ? "bg-primary/10 text-primary"
                  : analytics.totals.trend.direction === "down"
                    ? "bg-success/10 text-success"
                    : "bg-foreground/[0.055] text-muted dark:bg-white/[0.07]"
              )}
            >
              {analytics.totals.trend.direction === "up" ? (
                <TrendingUp size={14} />
              ) : analytics.totals.trend.direction === "down" ? (
                <TrendingDown size={14} />
              ) : (
                <BarChart3 size={14} />
              )}
              {getTrendText(analytics, t)}
            </span>
          </div>

          <StatGrid
            items={[
              {
                icon: Star,
                label: t("admin.analytics.metrics.reviews"),
                tone: "yellow",
                value: formatNumber(analytics.totals.counts.REVIEW, locale)
              },
              {
                icon: MessageCircleWarning,
                label: t("admin.analytics.metrics.complaints"),
                tone: "pink",
                value: formatNumber(analytics.totals.counts.COMPLAINT, locale)
              },
              {
                icon: Lightbulb,
                label: t("admin.analytics.metrics.suggestions"),
                tone: "green",
                value: formatNumber(analytics.totals.counts.SUGGESTION, locale)
              },
              {
                icon: SmilePlus,
                label: t("admin.analytics.metrics.mood"),
                tone: "blue",
                value: analytics.rating.average
                  ? `${getRatingEmoji(Math.round(analytics.rating.average))} ${analytics.rating.average}`
                  : "—"
              }
            ]}
          />
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel title={t("admin.analytics.overview.insightsTitle")}>
        <div className="grid gap-3">
          {insights.slice(0, 4).map((insight, index) => (
            <div key={insight} className="flex items-start gap-3">
              <MetricIcon
                icon={index === 0 ? Sparkles : index === 1 ? MessageSquareText : CheckCircle2}
                tone={index === 0 ? "purple" : index === 1 ? "orange" : "teal"}
              />
              <p className="ios-body min-w-0 flex-1 text-foreground">{insight}</p>
            </div>
          ))}
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel title={t("admin.analytics.overview.detailsTitle")}>
        <div className="grid gap-4">
          <ProgressRow
            label={t("admin.analytics.engagement.withText")}
            percent={getPercent(analytics.engagement.withText, total)}
            tone="blue"
            value={formatNumber(analytics.engagement.withText, locale)}
          />
          <ProgressRow
            label={t("admin.analytics.engagement.withPhotos")}
            percent={getPercent(analytics.engagement.withPhotos, total)}
            tone="purple"
            value={formatNumber(analytics.engagement.withPhotos, locale)}
          />
          <ProgressRow
            label={t("admin.analytics.engagement.withContact")}
            percent={getPercent(analytics.engagement.withContact, total)}
            tone="green"
            value={formatNumber(analytics.engagement.withContact, locale)}
          />
        </div>
      </AnalyticsPanel>
    </div>
  );
};

const MoodTab = ({
  analytics,
  locale,
  t
}: {
  analytics: AdminAnalyticsPayload;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  const totalReviews = analytics.totals.counts.REVIEW;
  const ratings = [5, 4, 3, 2, 1] as const;

  return (
    <div className="grid gap-5">
      <AnalyticsPanel>
        <StatGrid
          items={[
            {
              icon: SmilePlus,
              label: t("admin.analytics.mood.positive"),
              tone: "green",
              value: formatNumber(analytics.rating.positiveCount, locale)
            },
            {
              icon: BarChart3,
              label: t("admin.analytics.mood.neutral"),
              tone: "orange",
              value: formatNumber(analytics.rating.neutralCount, locale)
            },
            {
              icon: AlertTriangle,
              label: t("admin.analytics.mood.negative"),
              tone: "pink",
              value: formatNumber(analytics.rating.negativeCount, locale)
            },
            {
              icon: Star,
              label: t("admin.analytics.mood.average"),
              tone: "yellow",
              value: analytics.rating.average
                ? `${getRatingEmoji(Math.round(analytics.rating.average))} ${analytics.rating.average}`
                : "—"
            }
          ]}
        />
      </AnalyticsPanel>

      <AnalyticsPanel title={t("admin.analytics.mood.distribution")}>
        {totalReviews > 0 ? (
          <div className="grid gap-4">
            {ratings.map((rating) => {
              const key = String(rating) as keyof typeof analytics.rating.distribution;
              const count = analytics.rating.distribution[key];

              return (
                <ProgressRow
                  key={rating}
                  label={`${getRatingEmoji(rating)} ${t(getRatingLabelKey(rating))}`}
                  meta={formatPercent(getPercent(count, totalReviews))}
                  percent={getPercent(count, totalReviews)}
                  tone={rating >= 4 ? "green" : rating === 3 ? "orange" : "pink"}
                  value={formatNumber(count, locale)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyBlock text={t("admin.analytics.empty.reviews")} />
        )}
      </AnalyticsPanel>
    </div>
  );
};

const TopicList = ({
  items,
  kind,
  locale,
  t
}: {
  items: AdminAnalyticsBreakdownItem[];
  kind: "complaint" | "suggestion";
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (items.length === 0) {
    return <EmptyBlock text={t(`admin.analytics.empty.${kind}`)} />;
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <ProgressRow
          key={item.id}
          label={getTopicTitle(kind, item.id, t)}
          meta={formatPercent(getPercent(item.count, total))}
          percent={getPercent(item.count, total)}
          tone={kind === "complaint" ? "pink" : "green"}
          value={formatNumber(item.count, locale)}
        />
      ))}
    </div>
  );
};

const TopicsTab = ({
  analytics,
  locale,
  t
}: {
  analytics: AdminAnalyticsPayload;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => (
  <div className="grid gap-5">
    <AnalyticsPanel title={t("admin.analytics.topics.complaints")}>
      <TopicList items={analytics.topics.complaint} kind="complaint" locale={locale} t={t} />
    </AnalyticsPanel>
    <AnalyticsPanel title={t("admin.analytics.topics.suggestions")}>
      <TopicList items={analytics.topics.suggestion} kind="suggestion" locale={locale} t={t} />
    </AnalyticsPanel>
  </div>
);

const TeamTab = ({
  analytics,
  locale,
  t
}: {
  analytics: AdminAnalyticsPayload;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  const maxThanks = Math.max(...analytics.staff.items.map((item) => item.thanksCount), 1);

  return (
    <div className="grid gap-5">
      <AnalyticsPanel>
        <StatGrid
          items={[
            {
              icon: Sparkles,
              label: t("admin.analytics.team.thanks"),
              tone: "purple",
              value: formatNumber(
                analytics.staff.items.reduce((sum, item) => sum + item.thanksCount, 0) +
                  analytics.staff.team.thanksCount,
                locale
              )
            },
            {
              icon: UserRound,
              label: t("admin.analytics.team.mentions"),
              tone: "blue",
              value: formatNumber(
                analytics.staff.items.reduce((sum, item) => sum + item.mentionsCount, 0) +
                  analytics.staff.team.mentionsCount,
                locale
              )
            },
            {
              icon: UsersRound,
              label: t("admin.analytics.team.teamThanks"),
              tone: "green",
              value: formatNumber(analytics.staff.team.thanksCount, locale)
            },
            {
              icon: AlertTriangle,
              label: t("admin.analytics.team.attention"),
              tone: "pink",
              value: formatNumber(
                analytics.staff.items.reduce(
                  (sum, item) => sum + item.complaintCount + item.lowReviewCount,
                  0
                ) + analytics.staff.team.complaintCount,
                locale
              )
            }
          ]}
        />
      </AnalyticsPanel>

      <AnalyticsPanel title={t("admin.analytics.team.people")}>
        {analytics.staff.items.length > 0 ? (
          <div className="grid gap-4">
            {analytics.staff.items.map((item: AdminAnalyticsStaffItem) => (
              <ProgressRow
                key={item.id}
                label={item.displayName}
                meta={
                  item.roleTitle
                    ? t("admin.analytics.team.personMetaWithRole", {
                        complaints: item.complaintCount + item.lowReviewCount,
                        mentions: item.mentionsCount,
                        role: item.roleTitle
                      })
                    : t("admin.analytics.team.personMeta", {
                        complaints: item.complaintCount + item.lowReviewCount,
                        mentions: item.mentionsCount
                      })
                }
                percent={getPercent(item.thanksCount, maxThanks)}
                tone="purple"
                value={formatNumber(item.thanksCount, locale)}
              />
            ))}
          </div>
        ) : (
          <EmptyBlock text={t("admin.analytics.empty.team")} />
        )}
      </AnalyticsPanel>
    </div>
  );
};

const ContextsTab = ({
  analytics,
  locale,
  t
}: {
  analytics: AdminAnalyticsPayload;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  const maxCount = Math.max(...analytics.contexts.map((item) => item.count), 1);

  return (
    <AnalyticsPanel title={t("admin.analytics.contexts.title")}>
      {analytics.contexts.length > 0 ? (
        <div className="grid gap-4">
          {analytics.contexts.map((item) => (
            <ProgressRow
              key={item.label}
              label={item.label}
              meta={t("admin.analytics.contexts.meta", {
                complaints: item.complaintCount,
                lowReviews: item.lowReviewCount
              })}
              percent={getPercent(item.count, maxCount)}
              tone={item.complaintCount + item.lowReviewCount > 0 ? "orange" : "teal"}
              value={formatNumber(item.count, locale)}
            />
          ))}
        </div>
      ) : (
        <EmptyBlock text={t("admin.analytics.empty.contexts")} />
      )}
    </AnalyticsPanel>
  );
};

const TimeTab = ({
  analytics,
  locale,
  t
}: {
  analytics: AdminAnalyticsPayload;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  const maxDaily = Math.max(...analytics.time.daily.map((item) => item.ALL), 1);
  const maxWeekday = Math.max(...analytics.time.weekdays.map((item) => item.count), 1);

  return (
    <div className="grid gap-5">
      <AnalyticsPanel>
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="grid gap-1">
              <p className="ios-caption-1 font-semibold uppercase text-muted">
                {t("admin.analytics.time.peak")}
              </p>
              <h3 className="ios-title-2 font-semibold text-foreground">
                {analytics.time.peakHour
                  ? formatHour(analytics.time.peakHour.hour)
                  : t("admin.analytics.time.noPeak")}
              </h3>
            </div>
            <MetricIcon icon={Clock3} tone="teal" />
          </div>
          <div className="flex h-[104px] items-end gap-1.5">
            {analytics.time.daily.map((item) => (
              <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-[76px] w-full items-end">
                  <div
                    className="w-full rounded-t-full bg-primary/80"
                    style={{
                      height:
                        item.ALL > 0 ? `${Math.max(8, getPercent(item.ALL, maxDaily))}%` : "0%"
                    }}
                  />
                </div>
                <span className="ios-caption-2 max-w-full truncate text-muted">
                  {formatDate(item.date, locale)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </AnalyticsPanel>

      <AnalyticsPanel title={t("admin.analytics.time.weekdays")}>
        <div className="grid gap-4">
          {analytics.time.weekdays.map((item) => (
            <ProgressRow
              key={item.day}
              label={getWeekdayName(item.day, locale)}
              percent={getPercent(item.count, maxWeekday)}
              tone="blue"
              value={formatNumber(item.count, locale)}
            />
          ))}
        </div>
      </AnalyticsPanel>
    </div>
  );
};

const renderTab = ({
  activeTab,
  analytics,
  locale,
  t
}: {
  activeTab: AnalyticsTab;
  analytics: AdminAnalyticsPayload;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => {
  if (activeTab === "mood") {
    return <MoodTab analytics={analytics} locale={locale} t={t} />;
  }

  if (activeTab === "topics") {
    return <TopicsTab analytics={analytics} locale={locale} t={t} />;
  }

  if (activeTab === "team") {
    return <TeamTab analytics={analytics} locale={locale} t={t} />;
  }

  if (activeTab === "contexts") {
    return <ContextsTab analytics={analytics} locale={locale} t={t} />;
  }

  if (activeTab === "time") {
    return <TimeTab analytics={analytics} locale={locale} t={t} />;
  }

  return <OverviewTab analytics={analytics} locale={locale} t={t} />;
};

export const AdminAnalyticsPage = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/admin/$organizationId/analytics" });
  const tma = useTma();
  const { locale, t } = useI18n();
  const {
    isLoading: isOrganizationsLoading,
    organizations,
    setActiveOrganizationId
  } = useAdminOrganization();
  const [period, setPeriod] = React.useState<AdminAnalyticsPeriod>("30D");
  const [activeTab, setActiveTab] = React.useState<AnalyticsTab>("overview");
  const organization =
    organizations.find((item) => item.id === params.organizationId) ??
    organizations.find((item) => item.slug === params.organizationId) ??
    null;
  const analyticsQuery = useQuery({
    enabled: tma.isReady,
    queryFn: () =>
      fetchApiJson<AdminAnalyticsPayload>(
        `/api/organizations/${params.organizationId}/analytics?period=${period}`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: queryKeys.analytics(params.organizationId, period, tma.initDataRaw)
  });
  const analytics = analyticsQuery.data ?? null;
  const tabs: AnalyticsTab[] =
    analytics?.staff.enabled === true
      ? ["overview", "mood", "topics", "team", "contexts", "time"]
      : [...baseTabs];

  React.useEffect(() => {
    if (organization) {
      setActiveOrganizationId(organization.id);
    }
  }, [organization, setActiveOrganizationId]);

  React.useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab("overview");
    }
  }, [activeTab, tabs]);

  const goBack = React.useCallback(() => {
    void navigate({
      params: {
        organizationId: params.organizationId
      },
      to: "/admin/$organizationId"
    });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, goBack);

  if ((isOrganizationsLoading && !organization) || (analyticsQuery.isPending && !analytics)) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  if (analyticsQuery.isError && !analytics) {
    return (
      <PageTransition>
        <main className="tma-page bg-surface text-foreground">
          <div className="account-shell">
            <section className="grid gap-2">
              <h2 className="ios-title-1 font-semibold tracking-normal text-foreground">
                {t("admin.analytics.title")}
              </h2>
            </section>

            <div className="iz-liquid-list grid justify-items-center gap-3 rounded-[28px] border border-transparent p-6 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-[#FF3B30] text-white">
                <AlertTriangle size={17} strokeWidth={2.35} />
              </span>
              <div className="grid gap-1">
                <h3 className="ios-headline text-foreground">
                  {t("admin.analytics.loadErrorTitle")}
                </h3>
                <p className="ios-footnote max-w-[280px] text-muted">
                  {t("admin.analytics.loadErrorHint")}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  tma.haptics.impact("light");
                  void analyticsQuery.refetch();
                }}
              >
                <RefreshCw size={16} />
                {t("admin.analytics.retry")}
              </Button>
            </div>
          </div>
        </main>
      </PageTransition>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <section className="grid gap-3">
            <h2 className="ios-title-1 font-semibold tracking-normal text-foreground">
              {t("admin.analytics.title")}
            </h2>

            <div className="scrollbar-hide -mx-4 flex gap-1 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6">
              {ADMIN_ANALYTICS_PERIODS.map((item) => {
                const active = item === period;

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
                      setPeriod(item);
                    }}
                  >
                    {t(`admin.analytics.periods.${item}`)}
                  </button>
                );
              })}
            </div>

            <div className="scrollbar-hide -mx-4 flex gap-1 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6">
              {tabs.map((item) => {
                const active = item === activeTab;
                const Icon = tabIconMap[item];

                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "ios-touch-target ios-footnote relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_1px_4px_rgba(15,23,42,0.08)]"
                        : "bg-foreground/[0.045] text-muted hover:bg-foreground/[0.07] hover:text-foreground dark:bg-white/[0.055] dark:hover:bg-white/[0.08]"
                    )}
                    onClick={() => {
                      tma.haptics.selection();
                      setActiveTab(item);
                    }}
                  >
                    <Icon size={14.5} strokeWidth={2.35} />
                    {t(`admin.analytics.tabs.${item}`)}
                  </button>
                );
              })}
            </div>
          </section>

          <section>{renderTab({ activeTab, analytics, locale, t })}</section>
        </div>
      </main>
    </PageTransition>
  );
};
