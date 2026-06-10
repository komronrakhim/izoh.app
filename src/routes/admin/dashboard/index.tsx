import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Bell,
  ChevronRight,
  Globe2,
  Inbox,
  Languages,
  Lightbulb,
  MessageCircleQuestion,
  MessageCircleWarning,
  MessageSquareText,
  PanelsTopLeft,
  Plus,
  QrCode,
  SlidersHorizontal,
  Star,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import * as React from "react";

import { Avatar } from "~/common/components";
import { Button, List, ListIcon, PendingScreen } from "~/common/ui";
import { cn } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import {
  useAdminOrganization,
  type AdminOrganization
} from "~/shared/admin";
import {
  getDefaultGuestMenuItems,
  type GuestMenuItem,
  type GuestMenuItemId
} from "~/shared/guest-menu";
import { useI18n } from "~/shared/i18n/react";
import { queryKeys } from "~/shared/query";
import { PageTransition } from "~/shared/router/page-transition";
import { useTma, useTmaBackButton, useTmaMainButton } from "~/shared/tma";

type IconTone =
  | "analytics"
  | "complaint"
  | "create"
  | "feed"
  | "guestLink"
  | "locale"
  | "notifications"
  | "qr"
  | "review"
  | "staff"
  | "suggestion";

const iconToneClassNames: Record<IconTone, string> = {
  analytics: "bg-[#00C7BE] text-white",
  complaint: "bg-[#FF2D55] text-white",
  create: "bg-[#007AFF] text-white",
  feed: "bg-[#2AABEE] text-white",
  guestLink: "bg-[#32ADE6] text-white",
  locale: "bg-[#BF5AF2] text-white",
  notifications: "bg-[#FF3B30] text-white",
  qr: "bg-[#FF9500] text-white",
  review: "bg-[#FFB000] text-white",
  staff: "bg-[#9B6DFF] text-white",
  suggestion: "bg-[#34C759] text-white"
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
              { icon: Inbox, tone: "feed" as const },
              { icon: SlidersHorizontal, tone: "locale" as const }
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

          {!tma.isTelegram ? (
            <Button
              className="tma-fallback-action"
              size="lg"
              variant="primary"
              wide
              onClick={goToCreateOrganization}
            >
              {t("admin.organizations.introAction")}
              <ArrowRight aria-hidden="true" size={18} strokeWidth={2.35} />
            </Button>
          ) : null}
        </section>
      </main>
    </PageTransition>
  );
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const { error, isLoading, organizations, setActiveOrganizationId } = useAdminOrganization();

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
            <List
              title={t("admin.organizations.listTitle")}
              items={[
                ...organizations.map((organization) => ({
                  addon: {
                    after: <RowSuffix />,
                    before: (
                      <Avatar
                        alt={organization.name}
                        className="size-[30px] rounded-[9px]"
                        initialsClassName="ios-caption-2"
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
                })),
                ...(!isLoading
                  ? [
                      {
                        addon: {
                          after: <RowSuffix />,
                          before: <SettingsIcon icon={Plus} tone="create" />
                        },
                        href: "/admin/new",
                        title: t("admin.organizations.createAction")
                      }
                    ]
                  : [])
              ]}
            />
          ) : null}

          <List
            hint={t("admin.hints.system")}
            items={[
              {
                addon: {
                  after: <RowSuffix>{t(`common.locales.${locale}.label`)}</RowSuffix>,
                  before: <SettingsIcon icon={Languages} tone="locale" />
                },
                href: "/admin/language",
                title: t("admin.rows.locale")
              }
            ]}
          />
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
  const tma = useTma();
  const { t } = useI18n();
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
        <Avatar
          alt={organization.name}
          className="size-[108px] rounded-full ring-1 ring-border/60"
          initialsClassName="ios-large-title"
          name={organization.name}
          seed={organization.id}
          src={organization.logoUrl}
        />
        <div className="grid max-w-[420px] justify-items-center gap-1.5">
          <h2 className="ios-title-2 max-w-full truncate text-center font-semibold tracking-normal text-foreground">
            {organization.name}
          </h2>
          <p className="ios-footnote max-w-[360px] text-muted">{t("admin.organization")}</p>
        </div>
      </section>

      <div className="mt-2 grid gap-6">
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

        <footer className="flex justify-center px-4 pb-1 pt-2 text-black/45 dark:text-white/45">
          <span className="ios-caption-1 inline-flex items-center gap-1.5 font-medium">
            <PanelsTopLeft size={13} />
            {t("common.appType")}
          </span>
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
