import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Bell,
  ChevronRight,
  Globe2,
  Headset,
  ImagePlus,
  Inbox,
  Languages,
  Lightbulb,
  MessageCircleQuestion,
  MessageCircleWarning,
  MessageSquareText,
  Plus,
  QrCode,
  ShieldCheck,
  SquareArrowOutUpRight,
  Star,
  Trash2,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import * as React from "react";

import { Avatar } from "~/common/components";
import { List, ListIcon, LogoWordmark, PendingScreen, Spinner } from "~/common/ui";
import { cn } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import {
  MAX_ADMIN_ORGANIZATIONS,
  useAdminOrganization,
  type AdminOrganization
} from "~/shared/admin";
import {
  getDefaultGuestMenuItems,
  type GuestMenuItem,
  type GuestMenuItemId
} from "~/shared/guest-menu";
import { IZOH_SUPPORT_TELEGRAM_URL } from "~/shared/brand";
import { useI18n } from "~/shared/i18n/react";
import { LOGO_MAX_BYTES, isSupportedImageContentType, uploadImageAsset } from "~/shared/media";
import { queryKeys } from "~/shared/query";
import { PageTransition } from "~/shared/router/page-transition";
import {
  openTmaTelegramLink,
  showTmaPopup,
  useTma,
  useTmaBackButton,
  useTmaMainButton
} from "~/shared/tma";

type IconTone =
  | "analytics"
  | "complaint"
  | "create"
  | "faq"
  | "feed"
  | "guestLink"
  | "locale"
  | "notifications"
  | "qr"
  | "review"
  | "staff"
  | "subscription"
  | "support"
  | "suggestion"
  | "trash";

const iconToneClassNames: Record<IconTone, string> = {
  analytics: "bg-[#00C7BE] text-white",
  complaint: "bg-[#FF2D55] text-white",
  create: "bg-[#007AFF] text-white",
  faq: "bg-[#5856D6] text-white",
  feed: "bg-[#2AABEE] text-white",
  guestLink: "bg-[#32ADE6] text-white",
  locale: "bg-[#BF5AF2] text-white",
  notifications: "bg-[#FF3B30] text-white",
  qr: "bg-[#FF9500] text-white",
  review: "bg-[#FFB000] text-white",
  staff: "bg-[#9B6DFF] text-white",
  subscription: "bg-[#30B0C7] text-white",
  support: "bg-[#3B82F6] text-white",
  suggestion: "bg-[#34C759] text-white",
  trash: "bg-[#FF3B30] text-white"
};

const SettingsIcon = ({ icon: Icon, tone }: { icon: LucideIcon; tone: IconTone }) => (
  <ListIcon className={iconToneClassNames[tone]}>
    <Icon size={16} strokeWidth={2.35} />
  </ListIcon>
);

const IntroPointIcon = ({ icon: Icon, tone }: { icon: LucideIcon; tone: IconTone }) => (
  <span
    className={cn(
      "grid size-[46px] shrink-0 place-items-center rounded-[14px] shadow-[0_10px_24px_rgba(0,0,0,0.08)]",
      iconToneClassNames[tone]
    )}
  >
    <Icon size={23} strokeWidth={2.35} />
  </span>
);

const RowSuffix = ({ children, muted = true }: { children?: string; muted?: boolean }) => (
  <span className="flex min-w-0 items-center gap-2 text-muted">
    {children ? (
      <span
        className={cn(
          "ios-subhead min-w-0 max-w-[180px] truncate font-medium",
          muted ? "text-muted" : "text-foreground"
        )}
      >
        {children}
      </span>
    ) : null}
    <ChevronRight aria-hidden="true" size={17} className="shrink-0 text-muted/84" />
  </span>
);

const capabilityMeta: Record<GuestMenuItemId, { icon: LucideIcon; tone: IconTone }> = {
  complaint: {
    icon: MessageCircleWarning,
    tone: "complaint"
  },
  review: {
    icon: Star,
    tone: "review"
  },
  staff: {
    icon: UsersRound,
    tone: "staff"
  },
  suggestion: {
    icon: Lightbulb,
    tone: "suggestion"
  }
};

const feedbackCapabilityIds = ["review", "complaint", "suggestion"] as const satisfies Readonly<
  GuestMenuItemId[]
>;

const useRouteOrganization = (organizationId: string) => {
  const { isLoading, organizations, setActiveOrganizationId } = useAdminOrganization();
  const organization =
    organizations.find((item) => item.id === organizationId) ??
    organizations.find((item) => item.slug === organizationId) ??
    null;

  React.useEffect(() => {
    if (organization) {
      setActiveOrganizationId(organization.id);
    }
  }, [organization, setActiveOrganizationId]);

  return {
    isLoading,
    organization
  };
};

const AdminEmptyIntro = () => {
  const navigate = useNavigate();
  const tma = useTma();
  const { locale, t } = useI18n();

  const goToCreateOrganization = React.useCallback(() => {
    void navigate({
      to: "/admin/new"
    });
  }, [navigate]);

  const goToLanguage = React.useCallback(() => {
    tma.haptics.selection();
    void navigate({
      to: "/admin/language"
    });
  }, [navigate, tma.haptics]);

  const mainButtonState = React.useMemo(
    () => ({
      enabled: true,
      shine: true,
      text: t("admin.organizations.introAction"),
      visible: true
    }),
    [t]
  );

  useTmaMainButton(mainButtonState, goToCreateOrganization);

  return (
    <PageTransition>
      <main className="tma-page grid min-h-svh place-items-center bg-surface px-5 py-8 text-foreground">
        <section className="grid w-full max-w-[460px] justify-items-center gap-8 text-center">
          <div className="grid justify-items-center gap-3">
            <h1 className="ios-large-title max-w-[360px] text-balance font-semibold tracking-normal text-foreground">
              {t("admin.organizations.introTitle")}
            </h1>
            <p className="ios-body max-w-[350px] text-balance text-muted">
              {t("admin.organizations.introHint")}
            </p>
          </div>

          <div className="grid w-full gap-4 text-left">
            {[
              { icon: QrCode, tone: "qr" as const },
              { icon: MessageCircleQuestion, tone: "suggestion" as const },
              { icon: Inbox, tone: "feed" as const }
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-4 px-5 py-2.5">
                <IntroPointIcon icon={item.icon} tone={item.tone} />
                <div className="min-w-0 flex-1">
                  <h2 className="ios-body font-medium text-foreground">
                    {t(`admin.organizations.introPoints.${index}.title`)}
                  </h2>
                  <p className="ios-footnote mt-0.5 text-muted">
                    {t(`admin.organizations.introPoints.${index}.hint`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            aria-label={t("admin.language.action")}
            onClick={goToLanguage}
            className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-border/65 bg-surface-2/72 px-3.5 text-muted backdrop-blur-xl transition-colors active:bg-surface-3"
          >
            <Globe2 aria-hidden="true" size={17} strokeWidth={2.35} />
            <span className="ios-footnote truncate font-semibold">
              {t(`common.locales.${locale}.label`)}
            </span>
          </button>
        </section>
      </main>
    </PageTransition>
  );
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const { error, isLoading, organizations, setActiveOrganizationId, viewer } =
    useAdminOrganization();
  const isOrganizationLimitReached = organizations.length >= MAX_ADMIN_ORGANIZATIONS;
  const openSupport = React.useCallback(() => {
    openTmaTelegramLink(IZOH_SUPPORT_TELEGRAM_URL);
  }, []);

  if (isLoading && organizations.length === 0) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  if (!error && organizations.length === 0) {
    return <AdminEmptyIntro />;
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <section className="grid gap-2 px-4">
            <h1 className="ios-title-1 font-semibold tracking-normal text-foreground">
              {t("admin.organizations.hubTitle")}
            </h1>
            <p className="ios-footnote text-muted">{t("admin.organizations.hubHint")}</p>
          </section>

          {organizations.length > 0 || !isLoading ? (
            <section className="grid gap-2.5">
              {!isLoading && !isOrganizationLimitReached ? (
                <List
                  title={t("admin.organizations.listTitle")}
                  hint={
                    organizations.length > 0
                      ? undefined
                      : t("admin.organizations.listHint", {
                          count: MAX_ADMIN_ORGANIZATIONS
                        })
                  }
                  items={[
                    {
                      addon: {
                        after: <RowSuffix />,
                        before: <SettingsIcon icon={Plus} tone="create" />
                      },
                      href: "/admin/new",
                      title: t("admin.organizations.createAction")
                    }
                  ]}
                />
              ) : null}

              {organizations.length > 0 ? (
                <List
                  hint={t(
                    `admin.organizations.${isOrganizationLimitReached ? "listLimitHint" : "listHint"}`,
                    {
                      count: MAX_ADMIN_ORGANIZATIONS
                    }
                  )}
                  separatorInsetClassName="ml-[76px]"
                  spacing="md"
                  title={
                    !isLoading && !isOrganizationLimitReached
                      ? undefined
                      : t("admin.organizations.listTitle")
                  }
                  items={organizations.map((organization) => ({
                    addon: {
                      after: <RowSuffix />,
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
                    onClick: () => {
                      setActiveOrganizationId(organization.id);
                      void navigate({
                        params: { organizationId: organization.id },
                        to: "/admin/$organizationId"
                      });
                    },
                    title: organization.name
                  }))}
                />
              ) : null}
            </section>
          ) : null}

          <List
            items={[
              ...(viewer.isSystemAdmin
                ? [
                    {
                      addon: {
                        after: <RowSuffix />,
                        before: <SettingsIcon icon={ShieldCheck} tone="analytics" />
                      },
                      href: "/admin/system",
                      title: t("admin.rows.system")
                    }
                  ]
                : []),
              {
                addon: {
                  after: <RowSuffix>{t(`common.locales.${locale}.label`)}</RowSuffix>,
                  before: <SettingsIcon icon={Languages} tone="locale" />
                },
                href: "/admin/language",
                title: t("admin.rows.locale")
              },
              {
                addon: {
                  after: <RowSuffix />,
                  before: <SettingsIcon icon={MessageCircleQuestion} tone="faq" />
                },
                href: "/admin/faq",
                title: t("admin.rows.faq")
              },
              {
                addon: {
                  after: <RowSuffix />,
                  before: <SettingsIcon icon={Headset} tone="support" />
                },
                onClick: openSupport,
                title: t("admin.rows.support")
              }
            ]}
          />

          <footer className="flex justify-center px-4 pb-1 pt-2 text-black/38 dark:text-white/38">
            <LogoWordmark className="w-[42px]" />
          </footer>
        </div>
      </main>
    </PageTransition>
  );
};

export const AdminOrganizationOverview = ({
  isLoading,
  organization
}: {
  isLoading?: boolean;
  organization: AdminOrganization | null;
}) => {
  const navigate = useNavigate();
  const tma = useTma();
  const { t } = useI18n();
  const { refreshOrganizations } = useAdminOrganization();
  const logoInputId = React.useId();
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState<string | null>(null);
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const [isLogoSaving, setIsLogoSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const guestMenuQuery = useQuery({
    enabled: Boolean(organization) && tma.isReady,
    queryFn: () =>
      fetchApiJson<{ items?: GuestMenuItem[] }>(
        `/api/organizations/${organization!.id}/guest-menu`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: organization
      ? queryKeys.guestMenu(organization.id, tma.initDataRaw)
      : ["organization", "guest-menu", "idle"]
  });
  const guestMenuItems = React.useMemo(
    () => guestMenuQuery.data?.items ?? [],
    [guestMenuQuery.data?.items]
  );
  const isGuestMenuLoading = Boolean(organization) && guestMenuQuery.isLoading;
  const guestMenuById = React.useMemo(
    () => new Map(guestMenuItems.map((item) => [item.id, item])),
    [guestMenuItems]
  );
  const guestLinkQuery = useQuery({
    enabled: Boolean(organization) && tma.isReady,
    queryFn: () =>
      fetchApiJson<{ startParam?: string; url?: string }>(
        `/api/organizations/${organization!.id}/qr-link`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: organization
      ? queryKeys.organizationQrLink(organization.id, "", tma.initDataRaw)
      : ["organization", "qr-link", "idle"]
  });
  const guestFormUrl = guestLinkQuery.data?.url ?? null;

  React.useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const handleLogoChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;

      event.target.value = "";

      if (!organization || !file || isLogoSaving) {
        return;
      }

      if (!isSupportedImageContentType(file.type)) {
        setLogoError(t("admin.organizations.logoErrors.type"));
        return;
      }

      if (file.size > LOGO_MAX_BYTES) {
        setLogoError(t("admin.organizations.logoErrors.size"));
        return;
      }

      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }

      setLogoPreviewUrl(URL.createObjectURL(file));
      setLogoError(null);
      setIsLogoSaving(true);

      try {
        const assets = await uploadImageAsset({
          file,
          initDataRaw: tma.initDataRaw,
          kind: "ORGANIZATION_LOGO",
          ownerId: organization.id,
          ownerType: "ORGANIZATION"
        });
        const logoAsset = assets.find((asset) => asset.kind === "ORGANIZATION_LOGO");

        if (!logoAsset) {
          throw new Error("Logo asset was not returned.");
        }

        await fetchApiJson<AdminOrganization>(`/api/admin/organizations/${organization.id}/logo`, {
          body: JSON.stringify({
            logoMediaAssetId: logoAsset.id
          }),
          headers: {
            "Content-Type": "application/json"
          },
          initDataRaw: tma.initDataRaw,
          method: "PATCH"
        });

        await refreshOrganizations();
        tma.haptics.notification("success");
      } catch {
        setLogoError(t("admin.organizations.logoUpdateError"));
        setLogoPreviewUrl(null);
        tma.haptics.notification("error");
      } finally {
        setIsLogoSaving(false);
      }
    },
    [isLogoSaving, logoPreviewUrl, organization, refreshOrganizations, t, tma]
  );

  const handleDeleteOrganization = React.useCallback(async () => {
    if (!organization || isDeleting) {
      return;
    }

    tma.haptics.impact("medium");

    const buttonId = await showTmaPopup({
      buttons: [
        {
          id: "delete",
          text: t("admin.organizations.deletePopup.confirm"),
          type: "destructive"
        },
        {
          id: "cancel",
          type: "cancel"
        }
      ],
      message: t("admin.organizations.deletePopup.message", {
        name: organization.name
      }),
      title: t("admin.organizations.deletePopup.title")
    });

    if (buttonId !== "delete") {
      return;
    }

    setIsDeleting(true);

    try {
      await fetchApiJson<{ ok: true }>(`/api/admin/organizations/${organization.id}`, {
        initDataRaw: tma.initDataRaw,
        method: "DELETE"
      });

      await refreshOrganizations();
      tma.haptics.notification("success");
      void navigate({ to: "/admin" });
    } catch {
      setLogoError(t("admin.organizations.deleteError"));
      tma.haptics.notification("error");
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, navigate, organization, refreshOrganizations, t, tma]);

  const openGuestForm = React.useCallback(() => {
    if (!guestFormUrl) {
      return;
    }

    tma.haptics.selection();
    openTmaTelegramLink(guestFormUrl);
  }, [guestFormUrl, tma.haptics]);

  if (isLoading && !organization) {
    return <PendingScreen label={t("common.loading")} />;
  }

  if (!organization) {
    return (
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
    );
  }

  if (isGuestMenuLoading) {
    return <PendingScreen label={t("common.loading")} />;
  }

  return (
    <div className="account-shell">
      <section className="grid justify-items-center gap-4 text-center">
        <button
          aria-describedby={logoError ? `${logoInputId}-error` : undefined}
          aria-label={t("admin.organizations.logoAction")}
          className={cn(
            "group relative rounded-full outline-none transition-opacity active:opacity-80",
            isLogoSaving && "pointer-events-none opacity-80"
          )}
          type="button"
          onClick={() => {
            tma.haptics.impact("light");
            logoInputRef.current?.click();
          }}
        >
          <Avatar
            alt={organization.name}
            className="size-[108px] rounded-full ring-1 ring-border/60"
            initialsClassName="ios-large-title"
            name={organization.name}
            seed={organization.id}
            src={logoPreviewUrl ?? organization.logoUrl}
          />
          <span className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full border border-white/40 bg-primary text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            {isLogoSaving ? <Spinner size={16} /> : <ImagePlus size={16} strokeWidth={2.35} />}
          </span>
        </button>

        <input
          ref={logoInputRef}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          id={logoInputId}
          type="file"
          onChange={handleLogoChange}
        />

        <div className="grid max-w-[420px] justify-items-center gap-2">
          <h2 className="max-w-full text-center">
            <button
              aria-busy={guestLinkQuery.isLoading}
              aria-label={`${organization.name}. ${t("admin.organizations.openGuestForm")}`}
              className={cn(
                "ios-title-2 inline-flex max-w-full items-center justify-center gap-1.5 rounded-full px-2 py-1 font-semibold tracking-normal text-foreground outline-none transition-[color,opacity,background-color] active:opacity-75",
                "hover:bg-foreground/[0.055] hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/35",
                (!guestFormUrl || guestLinkQuery.isLoading) && "pointer-events-none opacity-70"
              )}
              disabled={!guestFormUrl || guestLinkQuery.isLoading}
              type="button"
              onClick={openGuestForm}
            >
              <span className="min-w-0 truncate">{organization.name}</span>
              {guestLinkQuery.isLoading ? (
                <Spinner size={16} />
              ) : (
                <SquareArrowOutUpRight
                  aria-hidden="true"
                  className="shrink-0 text-primary"
                  size={17}
                  strokeWidth={2.35}
                />
              )}
            </button>
          </h2>
          {logoError ? (
            <p id={`${logoInputId}-error`} className="ios-footnote px-4 text-center text-danger">
              {logoError}
            </p>
          ) : null}
        </div>
      </section>

      <div className="mt-2 grid gap-6">
        <List
          items={[
            {
              addon: {
                after: (
                  <RowSuffix muted={!organization.subscriptionActive}>
                    {t(`admin.values.${organization.subscriptionActive ? "active" : "inactive"}`)}
                  </RowSuffix>
                ),
                before: <SettingsIcon icon={BadgeCheck} tone="subscription" />
              },
              href: `/admin/${organization.id}/subscription`,
              title: t("admin.rows.subscription")
            }
          ]}
        />

        <List
          hint={t("admin.blocks.inbox.hint")}
          items={[
            {
              addon: {
                after: <RowSuffix />,
                before: <SettingsIcon icon={MessageSquareText} tone="feed" />
              },
              href: `/admin/${organization.id}/feed`,
              title: t("admin.rows.feed")
            },
            {
              addon: {
                after: <RowSuffix />,
                before: <SettingsIcon icon={BarChart3} tone="analytics" />
              },
              href: `/admin/${organization.id}/analytics`,
              title: t("admin.rows.analytics")
            }
          ]}
        />

        <List
          hint={t("admin.blocks.capabilities.hint")}
          items={feedbackCapabilityIds.map((id) => {
            const meta = capabilityMeta[id];
            const enabled = guestMenuById.get(id)?.enabled ?? false;

            return {
              addon: {
                after: (
                  <RowSuffix muted={!enabled}>
                    {t(`admin.values.${enabled ? "enabled" : "disabled"}`)}
                  </RowSuffix>
                ),
                before: <SettingsIcon icon={meta.icon} tone={meta.tone} />
              },
              href: `/admin/${organization.id}/${id}`,
              title: t(`admin.capabilities.${id}.title`)
            };
          })}
        />

        <List
          hint={t("admin.blocks.staff.hint")}
          items={[
            {
              addon: {
                after: (
                  <RowSuffix muted={!(guestMenuById.get("staff")?.enabled ?? false)}>
                    {t(
                      `admin.values.${guestMenuById.get("staff")?.enabled ? "enabled" : "disabled"}`
                    )}
                  </RowSuffix>
                ),
                before: <SettingsIcon icon={UsersRound} tone="staff" />
              },
              href: `/admin/${organization.id}/staff`,
              title: t("admin.capabilities.staff.title")
            }
          ]}
        />

        <List
          items={[
            {
              addon: {
                after: <RowSuffix>{t("admin.values.download")}</RowSuffix>,
                before: <SettingsIcon icon={QrCode} tone="qr" />
              },
              href: `/admin/${organization.id}/qr`,
              title: t("admin.rows.qr")
            },
            {
              addon: {
                after: <RowSuffix>{t("admin.values.setup")}</RowSuffix>,
                before: <SettingsIcon icon={Bell} tone="notifications" />
              },
              href: `/admin/${organization.id}/notifications`,
              title: t("admin.rows.notifications")
            }
          ]}
        />

        <List
          items={[
            {
              addon: {
                before: <SettingsIcon icon={Trash2} tone="trash" />
              },
              disabled: isLoading || isLogoSaving || isDeleting,
              onClick: handleDeleteOrganization,
              title: t("admin.organizations.delete"),
              variant: "destructive"
            }
          ]}
        />

        <footer className="flex justify-center px-4 pb-1 pt-2 text-black/38 dark:text-white/38">
          <LogoWordmark className="w-[42px]" />
        </footer>
      </div>
    </div>
  );
};

export const AdminOrganizationOverviewPage = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/admin/$organizationId" });
  const { isLoading, organization } = useRouteOrganization(params.organizationId);
  const backToDashboard = React.useCallback(() => {
    void navigate({ to: "/admin" });
  }, [navigate]);

  useTmaBackButton(true, backToDashboard);

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <AdminOrganizationOverview isLoading={isLoading} organization={organization} />
      </main>
    </PageTransition>
  );
};
