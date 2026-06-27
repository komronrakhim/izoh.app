import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ExternalLink, Minus, Plus } from "lucide-react";
import * as React from "react";

import { Input, List, ListIcon, PendingScreen, Toggle } from "~/common/ui";
import { fetchApiJson } from "~/shared/api";
import { useAdminOrganization } from "~/shared/admin";
import { getIntlLocale } from "~/shared/i18n";
import { useI18n } from "~/shared/i18n/react";
import {
  getDefaultModuleSettings,
  PUBLIC_REVIEW_MAX_RATING,
  PUBLIC_REVIEW_MIN_RATING,
  PUBLIC_REVIEW_PROVIDER_IDS,
  publicReviewSettingsSchema,
  type PublicReviewLink,
  type PublicReviewSettings,
  type ReviewModuleSettings
} from "~/shared/module-settings";
import { queryKeys } from "~/shared/query";
import { type PublicReviewMetricsPayload } from "~/shared/public-reviews";
import {
  PUBLIC_REVIEW_PROVIDER_LABELS,
  PUBLIC_REVIEW_PROVIDER_LOGOS,
  isBrandedPublicReviewProviderId,
  type BrandedPublicReviewProviderId,
  type PublicReviewProviderLogoProps
} from "~/shared/public-reviews/logos";
import { PageTransition } from "~/shared/router/page-transition";
import { useTma, useTmaBackButton, useTmaMainButton } from "~/shared/tma";

type ProviderMeta = {
  id: BrandedPublicReviewProviderId;
  label: string;
  logo: React.ComponentType<PublicReviewProviderLogoProps>;
  placeholder: string;
};

const providerMetaById = {
  google: {
    id: "google",
    label: PUBLIC_REVIEW_PROVIDER_LABELS.google,
    logo: PUBLIC_REVIEW_PROVIDER_LOGOS.google,
    placeholder: "https://www.google.com/maps/place/..."
  },
  yandex: {
    id: "yandex",
    label: PUBLIC_REVIEW_PROVIDER_LABELS.yandex,
    logo: PUBLIC_REVIEW_PROVIDER_LOGOS.yandex,
    placeholder: "https://yandex.ru/maps/org/..."
  },
  "2gis": {
    id: "2gis",
    label: PUBLIC_REVIEW_PROVIDER_LABELS["2gis"],
    logo: PUBLIC_REVIEW_PROVIDER_LOGOS["2gis"],
    placeholder: "https://2gis.ru/..."
  }
} as const satisfies Record<BrandedPublicReviewProviderId, ProviderMeta>;

const providerMeta = PUBLIC_REVIEW_PROVIDER_IDS.map((provider) => providerMetaById[provider]);

const providerLabels = new Map(providerMeta.map((provider) => [provider.id, provider.label]));
const providerSortOrder = new Map(providerMeta.map((provider, index) => [provider.id, index]));

const formatNumber = (value: number, locale: string) =>
  new Intl.NumberFormat(getIntlLocale(locale)).format(value);

const getLinkId = (provider: BrandedPublicReviewProviderId) => provider;

const createLink = ({
  label,
  provider,
  url
}: {
  label: string;
  provider: BrandedPublicReviewProviderId;
  url: string;
}): PublicReviewLink => ({
  enabled: true,
  id: getLinkId(provider),
  label,
  provider,
  sortOrder: providerSortOrder.get(provider) ?? 99,
  url
});

const getProviderLink = (settings: PublicReviewSettings, provider: BrandedPublicReviewProviderId) =>
  settings.links.find((link) => link.id === getLinkId(provider) || link.provider === provider);

const getBrandedLinks = (settings: PublicReviewSettings) =>
  settings.links.filter((link) => isBrandedPublicReviewProviderId(link.provider));

const RatingStepper = ({
  decreaseLabel,
  increaseLabel,
  label,
  onChange,
  value
}: {
  decreaseLabel: string;
  increaseLabel: string;
  label: string;
  onChange: (value: number) => void;
  value: number;
}) => {
  const buttonClassName =
    "grid size-7 place-items-center rounded-full bg-foreground/[0.08] text-foreground transition-[background-color,opacity] active:bg-foreground/[0.14] disabled:opacity-35 dark:bg-white/[0.12] dark:active:bg-white/[0.18]";

  return (
    <span className="flex items-center gap-1.5">
      <button
        aria-label={decreaseLabel}
        className={buttonClassName}
        disabled={value <= PUBLIC_REVIEW_MIN_RATING}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onChange(Math.max(PUBLIC_REVIEW_MIN_RATING, value - 1));
        }}
      >
        <Minus size={14} strokeWidth={2.35} />
      </button>
      <span className="ios-subhead min-w-[72px] text-center font-medium text-muted">{label}</span>
      <button
        aria-label={increaseLabel}
        className={buttonClassName}
        disabled={value >= PUBLIC_REVIEW_MAX_RATING}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onChange(Math.min(PUBLIC_REVIEW_MAX_RATING, value + 1));
        }}
      >
        <Plus size={14} strokeWidth={2.35} />
      </button>
    </span>
  );
};

const ProviderCard = ({
  countLabel,
  clearLabel,
  disabled,
  link,
  meta,
  onToggle,
  onUrlChange
}: {
  countLabel: string;
  clearLabel: string;
  disabled: boolean;
  link?: PublicReviewLink;
  meta: ProviderMeta;
  onToggle: (enabled: boolean) => void;
  onUrlChange: (value: string) => void;
}) => {
  const Logo = meta.logo;
  const hasUrl = Boolean(link?.url.trim());

  return (
    <section className="grid gap-3 rounded-[28px] border border-foreground/[0.08] bg-surface-2/70 p-4 dark:bg-surface-2/52">
      <div className="flex items-center gap-3">
        <ListIcon className="bg-white shadow-[0_1px_5px_rgba(15,23,42,0.12)]">
          <Logo className="size-[18px]" />
        </ListIcon>
        <div className="min-w-0 flex-1">
          <h2 className="ios-headline truncate text-foreground">{meta.label}</h2>
          <p className="ios-footnote text-muted">{countLabel}</p>
        </div>
        <Toggle
          checked={Boolean(link?.enabled && hasUrl)}
          disabled={!hasUrl || disabled}
          onCheckedChange={onToggle}
        />
      </div>

      <Input
        clearLabel={clearLabel}
        disabled={disabled}
        placeholder={meta.placeholder}
        type="url"
        value={link?.url ?? ""}
        wide
        onChange={(event) => onUrlChange(event.currentTarget.value)}
      />
    </section>
  );
};

const getMetricByProvider = (
  metrics: PublicReviewMetricsPayload | undefined,
  provider: BrandedPublicReviewProviderId
) => metrics?.providers.find((item) => item.provider === provider)?.count ?? 0;

export const AdminIntegrationsPage = () => {
  const params = useParams({ from: "/admin/$organizationId/integrations" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tma = useTma();
  const { locale, t } = useI18n();
  const {
    isLoading: organizationsLoading,
    organizations,
    setActiveOrganizationId
  } = useAdminOrganization();
  const organization =
    organizations.find((item) => item.id === params.organizationId) ??
    organizations.find((item) => item.slug === params.organizationId) ??
    null;
  const [draft, setDraft] = React.useState<PublicReviewSettings | null>(null);
  const [isDirty, setIsDirty] = React.useState(false);
  const [validationError, setValidationError] = React.useState("");

  React.useEffect(() => {
    if (organization) {
      setActiveOrganizationId(organization.id);
    }
  }, [organization, setActiveOrganizationId]);

  const backToOrganization = React.useCallback(() => {
    void navigate({
      params: {
        organizationId: params.organizationId
      },
      to: "/admin/$organizationId"
    });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, backToOrganization);

  const settingsQuery = useQuery({
    enabled: Boolean(organization),
    queryFn: () =>
      fetchApiJson<{ settings?: ReviewModuleSettings }>(
        `/api/organizations/${organization!.id}/modules/review/settings`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: organization
      ? queryKeys.moduleSettings(organization.id, "review", tma.initDataRaw)
      : ["organization", "module-settings", "review", "idle"]
  });
  const metricsQuery = useQuery({
    enabled: Boolean(organization),
    queryFn: () =>
      fetchApiJson<PublicReviewMetricsPayload>(
        `/api/organizations/${organization!.id}/integrations/metrics`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: organization
      ? queryKeys.publicReviewMetrics(organization.id, tma.initDataRaw)
      : ["organization", "public-review-metrics", "idle"]
  });

  const reviewSettings = settingsQuery.data?.settings ?? getDefaultModuleSettings("review");

  React.useEffect(() => {
    if (!settingsQuery.data?.settings || isDirty) {
      return;
    }

    setDraft(settingsQuery.data.settings.publicReview);
  }, [isDirty, settingsQuery.data?.settings]);

  const saveMutation = useMutation({
    mutationFn: async (publicReview: PublicReviewSettings) => {
      if (!organization) {
        throw new Error("Organization is not available.");
      }

      return fetchApiJson<{ settings?: ReviewModuleSettings }>(
        `/api/organizations/${organization.id}/modules/review/settings`,
        {
          body: JSON.stringify({
            publicReview
          }),
          headers: {
            "Content-Type": "application/json"
          },
          initDataRaw: tma.initDataRaw,
          method: "PATCH"
        }
      );
    },
    onSuccess: (payload) => {
      if (!organization || !payload.settings) {
        return;
      }

      queryClient.setQueryData<{ settings?: ReviewModuleSettings }>(
        queryKeys.moduleSettings(organization.id, "review", tma.initDataRaw),
        payload
      );
      setDraft(payload.settings.publicReview);
      setIsDirty(false);
      setValidationError("");
      tma.haptics.notification("success");
    },
    onError: () => {
      tma.haptics.notification("error");
    }
  });

  const publicReview = draft ?? reviewSettings.publicReview;
  const brandedLinks = getBrandedLinks(publicReview);
  const enabledLinks = brandedLinks.filter((link) => link.enabled).length;
  const totalClicks = providerMeta.reduce(
    (sum, provider) => sum + getMetricByProvider(metricsQuery.data, provider.id),
    0
  );

  const updateDraft = (updater: (current: PublicReviewSettings) => PublicReviewSettings) => {
    setDraft((current) => updater(current ?? reviewSettings.publicReview));
    setIsDirty(true);
    setValidationError("");
  };

  const updateLinkUrl = (provider: BrandedPublicReviewProviderId, url: string) => {
    const trimmedUrl = url.trim();
    const defaultLabel = providerLabels.get(provider) ?? provider;

    updateDraft((current) => {
      const links = current.links.filter(
        (link) => link.id !== getLinkId(provider) && link.provider !== provider
      );

      if (!trimmedUrl) {
        return {
          ...current,
          links
        };
      }

      const previous = getProviderLink(current, provider);
      const nextLink: PublicReviewLink = {
        ...(previous ??
          createLink({
            label: defaultLabel,
            provider,
            url: trimmedUrl
          })),
        enabled: previous?.enabled ?? true,
        id: getLinkId(provider),
        label: defaultLabel,
        provider,
        sortOrder: providerSortOrder.get(provider) ?? 99,
        url: trimmedUrl
      };

      return {
        ...current,
        links: [...links, nextLink].sort(
          (first, second) =>
            first.sortOrder - second.sortOrder || first.label.localeCompare(second.label)
        )
      };
    });
  };

  const updateLinkToggle = (provider: BrandedPublicReviewProviderId, enabled: boolean) => {
    updateDraft((current) => ({
      ...current,
      links: current.links.map((link) =>
        link.id === getLinkId(provider) || link.provider === provider
          ? {
              ...link,
              enabled
            }
          : link
      )
    }));
  };

  const save = React.useCallback(() => {
    const nextPublicReview = {
      ...publicReview,
      links: getBrandedLinks(publicReview)
    };
    const parsed = publicReviewSettingsSchema.safeParse(nextPublicReview);

    if (!parsed.success) {
      setValidationError(t("admin.publicReviews.validationError"));
      tma.haptics.notification("error");
      return;
    }

    saveMutation.mutate(parsed.data);
  }, [publicReview, saveMutation, t, tma.haptics]);

  useTmaMainButton(
    organization && draft
      ? {
          enabled: isDirty && !saveMutation.isPending,
          loading: saveMutation.isPending,
          text: t("common.actions.save"),
          visible: true
        }
      : null,
    save
  );

  if (!organizationsLoading && !organization) {
    return (
      <PageTransition>
        <main className="tma-page grid place-items-center bg-surface p-5 text-center text-foreground">
          <p className="ios-body text-muted">{t("admin.organizations.emptyTitle")}</p>
        </main>
      </PageTransition>
    );
  }

  if (organizationsLoading || settingsQuery.isLoading || !draft) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <section className="grid gap-2 px-4">
            <h2 className="ios-title-1 font-semibold tracking-normal text-foreground">
              {t("admin.publicReviews.title")}
            </h2>
            <p className="ios-footnote text-muted">{t("admin.publicReviews.subtitle")}</p>
          </section>

          <List
            title={t("admin.publicReviews.ruleTitle")}
            hint={t("admin.publicReviews.ruleHint")}
            items={[
              {
                addon: {
                  after: (
                    <Toggle
                      checked={publicReview.enabled}
                      onCheckedChange={(enabled) =>
                        updateDraft((current) => ({
                          ...current,
                          enabled
                        }))
                      }
                    />
                  ),
                  before: (
                    <ListIcon className="bg-[#34C759] text-white">
                      <ExternalLink size={15.5} strokeWidth={2.35} />
                    </ListIcon>
                  )
                },
                isAction: false,
                subtitle: t("admin.publicReviews.enabledSubtitle"),
                title: t("admin.publicReviews.enabled")
              },
              {
                addon: {
                  after: (
                    <RatingStepper
                      decreaseLabel={t("admin.publicReviews.thresholdDecrease")}
                      increaseLabel={t("admin.publicReviews.thresholdIncrease")}
                      label={t("admin.publicReviews.thresholdValue", {
                        value: publicReview.minRating
                      })}
                      value={publicReview.minRating}
                      onChange={(minRating) => {
                        if (minRating === publicReview.minRating) {
                          return;
                        }

                        tma.haptics.impact("light");
                        updateDraft((current) => ({
                          ...current,
                          minRating
                        }));
                      }}
                    />
                  ),
                  before: (
                    <ListIcon className="bg-[#FFB000] text-white">
                      <BadgeCheck size={15.5} strokeWidth={2.35} />
                    </ListIcon>
                  )
                },
                isAction: false,
                title: t("admin.publicReviews.threshold")
              }
            ]}
          />

          <section className="grid gap-3">
            <header className="px-4">
              <div className="min-w-0">
                <h2 className="ios-caption-1 font-semibold uppercase text-muted">
                  {t("admin.publicReviews.providersTitle")}
                </h2>
                <p className="ios-footnote mt-1 text-muted">
                  {t("admin.publicReviews.providersMeta", {
                    clicks: formatNumber(totalClicks, locale),
                    enabled: formatNumber(enabledLinks, locale)
                  })}
                </p>
              </div>
            </header>

            <div className="grid gap-3">
              {providerMeta.map((meta) => (
                <ProviderCard
                  key={meta.id}
                  countLabel={t("admin.publicReviews.providerClicks", {
                    value: formatNumber(getMetricByProvider(metricsQuery.data, meta.id), locale)
                  })}
                  clearLabel={t("common.actions.clear")}
                  disabled={saveMutation.isPending}
                  link={getProviderLink(publicReview, meta.id)}
                  meta={meta}
                  onToggle={(enabled) => updateLinkToggle(meta.id, enabled)}
                  onUrlChange={(url) => updateLinkUrl(meta.id, url)}
                />
              ))}
            </div>

            <p className="ios-footnote px-4 text-muted">{t("admin.publicReviews.providersHint")}</p>
          </section>

          {validationError ? (
            <p className="ios-footnote px-4 text-danger">{validationError}</p>
          ) : null}
        </div>
      </main>
    </PageTransition>
  );
};
