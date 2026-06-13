import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  CalendarClock,
  Check,
  ImagePlus,
  Inbox,
  Languages,
  QrCode,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import * as React from "react";

import {
  Badge,
  List,
  ListIcon,
  PendingScreen,
  STAR_CURRENCY_GLYPH,
  StarCurrencyIcon
} from "~/common/ui";
import { cn } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import { getIntlLocale } from "~/shared/i18n";
import { useI18n } from "~/shared/i18n/react";
import { queryKeys } from "~/shared/query";
import { PageTransition } from "~/shared/router/page-transition";
import {
  SUBSCRIPTION_PLANS,
  type OrganizationSubscriptionPayload,
  type SubscriptionInvoicePayload,
  type SubscriptionPlan,
  type SubscriptionPlanCode
} from "~/shared/subscriptions";
import { openTmaInvoice, useTma, useTmaBackButton, useTmaMainButton } from "~/shared/tma";

type SubscriptionPagePayload = {
  annualDiscountPercent: number;
  plans: typeof SUBSCRIPTION_PLANS;
  subscription: OrganizationSubscriptionPayload;
};

const PAYMENT_SYNC_ATTEMPTS = 12;
const PAYMENT_SYNC_INITIAL_DELAY_MS = 1_200;
const PAYMENT_SYNC_INTERVAL_MS = 1_500;
const SUBSCRIPTION_BENEFITS = [
  {
    icon: QrCode,
    key: "entry",
    tone: "bg-[#007AFF]"
  },
  {
    icon: Bell,
    key: "notifications",
    tone: "bg-[#FF3B30]"
  },
  {
    icon: Inbox,
    key: "feed",
    tone: "bg-[#FF9500]"
  },
  {
    icon: ImagePlus,
    key: "media",
    tone: "bg-[#AF52DE]"
  },
  {
    icon: UsersRound,
    key: "staff",
    tone: "bg-[#34C759]"
  },
  {
    icon: Languages,
    key: "languages",
    tone: "bg-[#5856D6]"
  }
] as const satisfies ReadonlyArray<{
  icon: LucideIcon;
  key: string;
  tone: string;
}>;

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isPaidInvoiceStatus = (status: string | null) => status?.toLowerCase() === "paid";

const isSubscriptionPaymentReflected = ({
  nextSubscription,
  payment,
  previousSubscription
}: {
  nextSubscription: OrganizationSubscriptionPayload;
  payment: SubscriptionInvoicePayload;
  previousSubscription?: OrganizationSubscriptionPayload;
}) => {
  if (
    nextSubscription.source !== "TELEGRAM_STARS" ||
    nextSubscription.status !== "ACTIVE" ||
    nextSubscription.planCode !== payment.plan.code ||
    nextSubscription.amountStars !== payment.plan.amountStars
  ) {
    return false;
  }

  if (!previousSubscription) {
    return true;
  }

  return (
    nextSubscription.amountStars !== previousSubscription.amountStars ||
    nextSubscription.currentPeriodEndsAt !== previousSubscription.currentPeriodEndsAt ||
    nextSubscription.currentPeriodStartedAt !== previousSubscription.currentPeriodStartedAt ||
    nextSubscription.planCode !== previousSubscription.planCode ||
    nextSubscription.source !== previousSubscription.source ||
    nextSubscription.status !== previousSubscription.status
  );
};

const StarAmount = ({
  amount,
  className,
  iconClassName
}: {
  amount: number;
  className?: string;
  iconClassName?: string;
}) => (
  <span className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}>
    {amount}
    <StarCurrencyIcon
      className={cn("size-3.5 text-[#FFB000] dark:text-[#FFD60A]", iconClassName)}
    />
  </span>
);

const StatusIcon = ({ active }: { active: boolean }) => (
  <ListIcon className={active ? "bg-[#34C759] text-white" : "bg-[#FF9500] text-white"}>
    {active ? (
      <BadgeCheck size={16} strokeWidth={2.35} />
    ) : (
      <CalendarClock size={16} strokeWidth={2.35} />
    )}
  </ListIcon>
);

const PlanCard = ({
  discountPercent,
  plan,
  selected,
  title,
  subtitle,
  badge,
  onClick
}: {
  badge?: string;
  discountPercent?: number;
  onClick: () => void;
  plan: SubscriptionPlan;
  selected: boolean;
  subtitle: string;
  title: string;
}) => (
  <button
    className={cn(
      "relative grid min-h-[142px] overflow-hidden rounded-[28px] border p-4 text-left transition-[background-color,border-color,transform,opacity] duration-200 active:scale-[0.985]",
      selected
        ? "border-primary/42 bg-primary text-primary-foreground"
        : "border-transparent bg-surface-2 text-foreground"
    )}
    type="button"
    onClick={onClick}
  >
    <span
      className={cn(
        "absolute right-3 top-3 grid size-6 place-items-center rounded-full border",
        selected ? "border-white/28 bg-white/20 text-white" : "border-border bg-surface text-muted"
      )}
    >
      {selected ? <Check size={14} strokeWidth={2.45} /> : null}
    </span>

    <span className="grid gap-1 pr-8">
      <span className="ios-headline font-semibold">{title}</span>
      <span className={cn("ios-caption-1", selected ? "text-white/76" : "text-muted")}>
        {subtitle}
      </span>
    </span>

    <span className="mt-5 self-end">
      <StarAmount
        amount={plan.amountStars}
        className={cn("ios-title-2 font-semibold", selected ? "text-white" : "text-foreground")}
        iconClassName={selected ? "text-white" : undefined}
      />
      {badge ? (
        <span
          className={cn(
            "ios-caption-1 mt-2 inline-flex rounded-full px-2 py-1 font-semibold",
            selected ? "bg-white/18 text-white" : "bg-success/12 text-success"
          )}
        >
          {discountPercent ? `${badge} ${discountPercent}%` : badge}
        </span>
      ) : null}
    </span>
  </button>
);

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: "numeric",
    month: "long"
  }).format(new Date(value));
};

export const AdminSubscriptionPage = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/admin/$organizationId/subscription" });
  const tma = useTma();
  const queryClient = useQueryClient();
  const { locale, t } = useI18n();
  const [selectedPlanCode, setSelectedPlanCode] = React.useState<SubscriptionPlanCode>("MONTHLY");
  const successfulPaymentIdRef = React.useRef<string | null>(null);

  const goBack = React.useCallback(() => {
    void navigate({
      params: {
        organizationId: params.organizationId
      },
      to: "/admin/$organizationId"
    });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, goBack);

  const subscriptionQuery = useQuery({
    queryFn: () =>
      fetchApiJson<SubscriptionPagePayload>(
        `/api/organizations/${params.organizationId}/subscription`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: queryKeys.subscription(params.organizationId, tma.initDataRaw)
  });

  const subscriptionQueryKey = queryKeys.subscription(params.organizationId, tma.initDataRaw);
  const adminOrganizationsQueryKey = queryKeys.adminOrganizations(tma.initDataRaw);

  const notifyPaymentSuccess = React.useCallback(
    (paymentId: string) => {
      if (successfulPaymentIdRef.current === paymentId) {
        return;
      }

      successfulPaymentIdRef.current = paymentId;
      tma.haptics.notification("success");
    },
    [tma.haptics]
  );

  const fetchFreshSubscription = React.useCallback(async () => {
    const payload = await fetchApiJson<SubscriptionPagePayload>(
      `/api/organizations/${params.organizationId}/subscription`,
      {
        initDataRaw: tma.initDataRaw
      }
    );

    queryClient.setQueryData<SubscriptionPagePayload>(subscriptionQueryKey, payload);

    return payload;
  }, [params.organizationId, queryClient, subscriptionQueryKey, tma.initDataRaw]);

  const syncPaymentState = React.useCallback(
    async ({
      initialDelayMs,
      payment,
      previousSubscription
    }: {
      initialDelayMs: number;
      payment: SubscriptionInvoicePayload;
      previousSubscription?: OrganizationSubscriptionPayload;
    }) => {
      for (let attempt = 0; attempt < PAYMENT_SYNC_ATTEMPTS; attempt += 1) {
        if (attempt === 0 && initialDelayMs > 0) {
          await delay(initialDelayMs);
        } else if (attempt > 0) {
          await delay(PAYMENT_SYNC_INTERVAL_MS);
        }

        try {
          const payload = await fetchFreshSubscription();

          if (
            isSubscriptionPaymentReflected({
              nextSubscription: payload.subscription,
              payment,
              previousSubscription
            })
          ) {
            notifyPaymentSuccess(payment.paymentId);
            await queryClient.invalidateQueries({
              queryKey: adminOrganizationsQueryKey
            });
            return true;
          }
        } catch {
          // The next polling tick will try again; payment sync should stay quiet for the user.
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: subscriptionQueryKey
        }),
        queryClient.invalidateQueries({
          queryKey: adminOrganizationsQueryKey
        })
      ]);

      return false;
    },
    [
      adminOrganizationsQueryKey,
      fetchFreshSubscription,
      notifyPaymentSuccess,
      queryClient,
      subscriptionQueryKey
    ]
  );

  const handleInvoiceCreated = React.useCallback(
    (payment: SubscriptionInvoicePayload) => {
      const previousSubscription = subscriptionQuery.data?.subscription ?? payment.subscription;
      let didStartSync = false;
      let syncTimeout: number | undefined;

      const startSync = (initialDelayMs: number) => {
        if (didStartSync) {
          return;
        }

        didStartSync = true;

        if (syncTimeout !== undefined) {
          window.clearTimeout(syncTimeout);
        }

        void syncPaymentState({
          initialDelayMs,
          payment,
          previousSubscription
        });
      };

      syncTimeout = window.setTimeout(() => {
        startSync(0);
      }, PAYMENT_SYNC_INITIAL_DELAY_MS);

      void openTmaInvoice(payment.invoiceLink).then((status) => {
        if (isPaidInvoiceStatus(status)) {
          notifyPaymentSuccess(payment.paymentId);
          startSync(0);
        }
      });
    },
    [notifyPaymentSuccess, subscriptionQuery.data?.subscription, syncPaymentState]
  );

  const invoiceMutation = useMutation({
    mutationFn: (planCode: SubscriptionPlanCode) =>
      fetchApiJson<SubscriptionInvoicePayload>(
        `/api/organizations/${params.organizationId}/subscription/invoices`,
        {
          body: JSON.stringify({
            planCode
          }),
          headers: {
            "Content-Type": "application/json"
          },
          initDataRaw: tma.initDataRaw,
          method: "POST"
        }
      ),
    onSuccess: handleInvoiceCreated
  });

  const selectedPlan =
    subscriptionQuery.data?.plans[selectedPlanCode] ?? SUBSCRIPTION_PLANS.MONTHLY;
  const monthlyPlan = subscriptionQuery.data?.plans.MONTHLY ?? SUBSCRIPTION_PLANS.MONTHLY;
  const subscription = subscriptionQuery.data?.subscription;
  const hasSettledActiveSubscription = Boolean(
    subscription?.isActive &&
    (subscription.status === "ACTIVE" || subscription.status === "GRANTED")
  );
  const showPaymentOptions = !hasSettledActiveSubscription;
  const isPaying = invoiceMutation.isPending;
  const canPay = subscriptionQuery.isSuccess && showPaymentOptions && !isPaying;
  const payButtonText = t("admin.subscription.payAction", {
    amount: selectedPlan.amountStars
  });
  const nativeMainButtonText = `${payButtonText} ${STAR_CURRENCY_GLYPH}`;

  useTmaMainButton(
    showPaymentOptions
      ? {
          enabled: canPay,
          loading: isPaying,
          shine: canPay,
          text: nativeMainButtonText,
          visible: subscriptionQuery.isSuccess
        }
      : null,
    () => {
      if (showPaymentOptions) {
        invoiceMutation.mutate(selectedPlanCode);
      }
    }
  );

  if (subscriptionQuery.isLoading && !subscriptionQuery.data) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  const periodEnd = subscription?.currentPeriodEndsAt ?? subscription?.trialEndsAt ?? null;
  const statusKey = subscription?.status ?? "EXPIRED";
  const isActive = Boolean(subscription?.isActive);
  const statusHint = periodEnd
    ? t(`admin.subscription.statusHints.${statusKey}`, {
        date: formatDate(periodEnd, locale)
      })
    : t(`admin.subscription.statusHintsNoDate.${statusKey}`);
  const activePeriodText = periodEnd
    ? t("admin.subscription.activeUntil", {
        date: formatDate(periodEnd, locale)
      })
    : t("admin.subscription.activeNoPeriod");
  const currentPlanTitle = subscription?.planCode
    ? t(`admin.subscription.plans.${subscription.planCode}.title`)
    : t("admin.subscription.currentPlanFallback");
  const benefitItems = SUBSCRIPTION_BENEFITS.map(({ icon: Icon, key, tone }) => ({
    addon: {
      before: (
        <ListIcon className={cn(tone, "text-white")}>
          <Icon size={16} strokeWidth={2.35} />
        </ListIcon>
      )
    },
    isAction: false,
    subtitle: t(`admin.subscription.benefits.items.${key}.subtitle`),
    title: t(`admin.subscription.benefits.items.${key}.title`)
  }));

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          {hasSettledActiveSubscription ? (
            <>
              <section className="grid gap-5 overflow-hidden rounded-[32px] border border-success/16 bg-surface-2 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid size-[52px] place-items-center rounded-[18px] bg-success text-white">
                    <BadgeCheck size={25} strokeWidth={2.35} />
                  </span>
                  <Badge variant="success">{t("admin.subscription.activeBadge")}</Badge>
                </div>

                <div className="grid gap-2">
                  <h1 className="ios-title-2 font-semibold tracking-normal text-foreground">
                    {t("admin.subscription.activeHeroTitle")}
                  </h1>
                  <p className="ios-footnote max-w-[430px] text-muted">
                    {t("admin.subscription.activeHeroSubtitle")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="grid gap-1 rounded-[22px] bg-surface px-4 py-3">
                    <span className="ios-caption-1 font-medium text-muted">
                      {t("admin.subscription.activePlanLabel")}
                    </span>
                    <span className="ios-body truncate font-medium text-foreground">
                      {currentPlanTitle}
                    </span>
                  </div>

                  <div className="grid gap-1 rounded-[22px] bg-surface px-4 py-3">
                    <span className="ios-caption-1 font-medium text-muted">
                      {t("admin.subscription.activePeriodLabel")}
                    </span>
                    <span className="ios-body truncate font-medium text-foreground">
                      {activePeriodText}
                    </span>
                  </div>
                </div>
              </section>

              <List
                hint={t("admin.subscription.benefits.activeHint")}
                items={benefitItems}
                title={t("admin.subscription.benefits.activeTitle")}
              />
            </>
          ) : (
            <>
              <section className="grid overflow-hidden rounded-[32px] bg-primary p-5 text-primary-foreground">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="ios-caption-1 inline-flex items-center rounded-full bg-white/18 px-2.5 py-1 font-semibold text-white">
                    {t("admin.subscription.trialBadge")}
                  </span>
                  <span className="ios-caption-1 inline-flex items-center gap-1.5 rounded-full bg-white/18 px-2.5 py-1 font-semibold text-white">
                    {t("admin.subscription.from")}
                    <StarAmount
                      amount={monthlyPlan.amountStars}
                      className="text-white"
                      iconClassName="text-white"
                    />
                  </span>
                </div>
                <div className="grid gap-2">
                  <h1 className="ios-title-1 font-semibold tracking-normal">
                    {t("admin.subscription.heroTitle")}
                  </h1>
                  <p className="ios-footnote max-w-[420px] text-white/78">
                    {t("admin.subscription.heroSubtitle")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["form", "notifications", "entry"] as const).map((key) => (
                      <span
                        key={key}
                        className="ios-caption-1 rounded-full bg-white/14 px-2.5 py-1 font-semibold text-white/88"
                      >
                        {t(`admin.subscription.heroChips.${key}`)}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              <List
                hint={statusHint}
                items={[
                  {
                    addon: {
                      after: (
                        <Badge variant={isActive ? "success" : "warning"}>
                          {t(`admin.subscription.statuses.${statusKey}`)}
                        </Badge>
                      ),
                      before: <StatusIcon active={isActive} />
                    },
                    isAction: false,
                    title: t("admin.subscription.statusTitle")
                  }
                ]}
              />

              <section className="grid gap-2.5">
                <header className="px-4">
                  <h2 className="ios-caption-1 font-semibold uppercase text-muted">
                    {t("admin.subscription.plansTitle")}
                  </h2>
                </header>
                <div className="grid grid-cols-2 gap-3">
                  {(["MONTHLY", "ANNUAL"] as const).map((planCode) => {
                    const plan =
                      subscriptionQuery.data?.plans[planCode] ?? SUBSCRIPTION_PLANS[planCode];
                    const selected = selectedPlanCode === planCode;
                    const discountPercent = subscriptionQuery.data?.annualDiscountPercent ?? 17;
                    const hasAnnualDiscount = planCode === "ANNUAL" && discountPercent > 0;

                    return (
                      <PlanCard
                        key={planCode}
                        badge={
                          hasAnnualDiscount ? t("admin.subscription.plans.ANNUAL.badge") : undefined
                        }
                        discountPercent={hasAnnualDiscount ? discountPercent : undefined}
                        plan={plan}
                        selected={selected}
                        subtitle={t(`admin.subscription.plans.${planCode}.subtitle`)}
                        title={t(`admin.subscription.plans.${planCode}.title`)}
                        onClick={() => {
                          tma.haptics.impact("light");
                          setSelectedPlanCode(planCode);
                        }}
                      />
                    );
                  })}
                </div>
                <p className="ios-footnote px-4 text-muted">
                  {t("admin.subscription.plansHint", {
                    discount: subscriptionQuery.data?.annualDiscountPercent ?? 17
                  })}
                </p>
              </section>

              {invoiceMutation.isError ? (
                <p className="ios-footnote px-4 text-danger">{t("admin.subscription.payError")}</p>
              ) : null}

              <List
                hint={t("admin.subscription.benefits.previewHint")}
                items={benefitItems}
                title={t("admin.subscription.benefits.previewTitle")}
              />
            </>
          )}
        </div>
      </main>
    </PageTransition>
  );
};
