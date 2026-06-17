import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Building2,
  ChevronRight,
  Gift,
  MessageSquareText,
  Radar,
  ScanLine,
  ShieldCheck,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import * as React from "react";

import { Avatar } from "~/common/components";
import { Badge, Button, List, ListIcon, PendingScreen, Tabs } from "~/common/ui";
import { cn } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import { useAdminOrganization } from "~/shared/admin";
import { getIntlLocale } from "~/shared/i18n";
import { useI18n } from "~/shared/i18n/react";
import { queryKeys } from "~/shared/query";
import { PageTransition } from "~/shared/router/page-transition";
import type { SubscriptionPlanCode } from "~/shared/subscriptions";
import {
  SYSTEM_PULSE_PERIODS,
  type SystemPulseMetric,
  type SystemPulseOrganizationItem,
  type SystemPulsePayload,
  type SystemPulsePeriod,
  type SystemPulseSubmissionItem
} from "~/shared/system";
import { useTma, useTmaBackButton } from "~/shared/tma";

type SystemMetricId =
  | "activeSubscriptions"
  | "organizations"
  | "scans"
  | "submissions"
  | "users";

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

const submissionTone: Record<SystemPulseSubmissionItem["kind"], string> = {
  COMPLAINT: "bg-[#FF2D55] text-white",
  REVIEW: "bg-[#FFB000] text-white",
  SUGGESTION: "bg-[#34C759] text-white"
};

const RowSuffix = ({ children }: { children?: React.ReactNode }) => (
  <span className="flex min-w-0 items-center gap-2 text-muted">
    {children ? (
      <span className="ios-subhead min-w-0 max-w-[168px] truncate font-medium">{children}</span>
    ) : null}
    <ChevronRight aria-hidden="true" size={17} className="shrink-0 text-muted/84" />
  </span>
);

const formatDate = (value: string, locale: string) =>
  new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));

const formatOwner = (owner: SystemPulseOrganizationItem["owner"]) => {
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
  const username = owner.username ? `@${owner.username}` : null;

  return [name || owner.telegramId, username].filter(Boolean).join(" · ");
};

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
    </div>
  );
};

const EmptySection = ({ text }: { text: string }) => (
  <div className="ios-footnote rounded-[24px] border border-dashed border-border/80 px-4 py-5 text-center text-muted">
    {text}
  </div>
);

export const AdminSystemPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tma = useTma();
  const { locale, t } = useI18n();
  const { isLoading: isAdminLoading, viewer } = useAdminOrganization();
  const [period, setPeriod] = React.useState<SystemPulsePeriod>("7D");
  const [grantingOrganizationId, setGrantingOrganizationId] = React.useState<string | null>(null);
  const number = React.useMemo(() => new Intl.NumberFormat(getIntlLocale(locale)), [locale]);
  const canLoadSystem = tma.isReady && Boolean(tma.initDataRaw) && viewer.isSystemAdmin;
  const pulseQuery = useQuery({
    enabled: canLoadSystem,
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

  const goBack = React.useCallback(() => {
    void navigate({ to: "/admin" });
  }, [navigate]);

  useTmaBackButton(true, goBack);

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
      await queryClient.invalidateQueries({
        queryKey: ["system", "pulse"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin", "organizations"]
      });
    }
  });

  const grantSubscription = React.useCallback(
    (organizationId: string, planCode: SubscriptionPlanCode = "ANNUAL") => {
      if (grantMutation.isPending) {
        return;
      }

      setGrantingOrganizationId(organizationId);
      grantMutation.mutate({
        organizationId,
        planCode
      });
    },
    [grantMutation]
  );

  if (isAdminLoading) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  if (!viewer.isSystemAdmin) {
    return (
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
    );
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <section className="grid gap-3 px-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ListIcon className="bg-[#111827] text-white dark:bg-white dark:text-black">
                    <Activity size={16} strokeWidth={2.35} />
                  </ListIcon>
                  <Badge variant="info">{t("admin.system.badge")}</Badge>
                </div>
                <h1 className="ios-title-1 mt-3 font-semibold tracking-normal text-foreground">
                  {t("admin.system.title")}
                </h1>
                <p className="ios-footnote mt-1 max-w-[360px] text-muted">
                  {t("admin.system.subtitle")}
                </p>
              </div>
              {conversion !== null ? (
                <div className="shrink-0 rounded-[20px] bg-foreground/[0.055] px-3 py-2 text-right">
                  <span className="ios-title-3 block font-semibold tracking-normal">
                    {conversion}%
                  </span>
                  <span className="ios-caption-1 font-semibold uppercase text-muted">
                    {t("admin.system.conversion")}
                  </span>
                </div>
              ) : null}
            </div>

            <Tabs
              compact
              value={period}
              items={SYSTEM_PULSE_PERIODS.map((item) => ({
                label: t(`admin.system.periods.${item}`),
                value: item
              }))}
              onValueChange={(value) => setPeriod(value as SystemPulsePeriod)}
            />
          </section>

          {pulseQuery.isLoading && !pulse ? (
            <PendingScreen label={t("common.loading")} />
          ) : pulseQuery.isError ? (
            <section className="grid justify-items-center gap-3 px-4 text-center">
              <Radar className="text-muted" size={34} strokeWidth={2.2} />
              <h2 className="ios-title-3 font-semibold tracking-normal">
                {t("admin.system.loadErrorTitle")}
              </h2>
              <p className="ios-footnote max-w-[340px] text-muted">
                {t("admin.system.loadErrorHint")}
              </p>
              <Button size="sm" onClick={() => void pulseQuery.refetch()}>
                {t("admin.system.retry")}
              </Button>
            </section>
          ) : pulse ? (
            <>
              <section className="grid grid-cols-2 gap-2 px-1">
                {(
                  [
                    "submissions",
                    "scans",
                    "users",
                    "organizations",
                    "activeSubscriptions"
                  ] as const
                ).map((id) => (
                  <MetricTile key={id} id={id} metric={pulse.totals[id]} period={period} />
                ))}
              </section>

              <section className="grid gap-2.5">
                {pulse.recentSubmissions.length > 0 ? (
                  <List
                    title={t("admin.system.sections.recentSubmissions")}
                    items={pulse.recentSubmissions.map((submission) => ({
                      addon: {
                        after: <RowSuffix>{formatDate(submission.createdAt, locale)}</RowSuffix>,
                        before: (
                          <ListIcon className={submissionTone[submission.kind]}>
                            <MessageSquareText size={16} strokeWidth={2.35} />
                          </ListIcon>
                        )
                      },
                      href: `/admin/${submission.organization.id}/feed`,
                      subtitle: [
                        submission.organization.name,
                        submission.qrContext
                          ? t("admin.system.context", {
                              value: submission.qrContext
                            })
                          : null,
                        submission.rating
                          ? t("admin.system.rating", {
                              value: submission.rating
                            })
                          : null
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      title: (
                        <span className="line-clamp-1">
                          {t(`admin.feed.kind.${submission.kind}`)} · {submission.preview}
                        </span>
                      )
                    }))}
                  />
                ) : (
                  <EmptySection text={t("admin.system.emptySubmissions")} />
                )}
              </section>

              <section className="grid gap-2.5">
                {pulse.organizations.length > 0 ? (
                  <List
                    hint={t("admin.system.sections.organizationsHint")}
                    separatorInsetClassName="ml-[76px]"
                    spacing="md"
                    title={t("admin.system.sections.organizations")}
                    items={pulse.organizations.map((organization) => ({
                      addon: {
                        after: (
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="hidden min-w-0 text-right xs:block">
                              <span className="ios-caption-1 block font-semibold text-foreground">
                                {number.format(organization.scanCount)} /{" "}
                                {number.format(organization.submissionCount)}
                              </span>
                              <span className="ios-caption-2 block text-muted">
                                {t("admin.system.scanSubmissionPair")}
                              </span>
                            </span>
                            <button
                              className={cn(
                                "ios-caption-1 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary px-3 font-semibold text-white transition-[opacity,transform] active:scale-95 disabled:pointer-events-none disabled:opacity-50",
                                organization.subscription.isActive &&
                                  "bg-foreground/[0.08] text-foreground"
                              )}
                              disabled={grantMutation.isPending}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                grantSubscription(organization.id);
                              }}
                            >
                              <Gift size={13} strokeWidth={2.5} />
                              {grantingOrganizationId === organization.id
                                ? t("admin.system.granting")
                                : t(
                                    `admin.system.${organization.subscription.isActive ? "extendAction" : "grantAction"}`
                                  )}
                            </button>
                          </div>
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
                      isAction: false,
                      subtitle: formatOwner(organization.owner),
                      title: organization.name
                    }))}
                  />
                ) : (
                  <EmptySection text={t("admin.system.emptyOrganizations")} />
                )}
              </section>
            </>
          ) : null}
        </div>
      </main>
    </PageTransition>
  );
};
