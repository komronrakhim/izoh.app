import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Coins, FolderOpen, Plus } from "lucide-react";
import * as React from "react";

import { List, PendingScreen, Toggle } from "~/common/ui";
import { ApiError } from "~/shared/api";
import { useI18n } from "~/shared/i18n/react";
import { PageTransition } from "~/shared/router/page-transition";
import { useTma, useTmaBackButton } from "~/shared/tma";

import {
  createAdminMenu,
  setAdminMenuQueryData,
  updateAdminMenu,
  updateAdminMenuEnabled,
  useAdminMenuQuery
} from "./api";
import {
  AdminMenuStateScreen,
  MenuCurrencyPicker,
  MenuListIcon,
  MenuPageHeader,
  MenuRowSuffix,
  sortMenuEntities,
  useAdminMenuOrganization,
  useAdminMenuRouteParams
} from "./components";
import type { MenuCurrencyCode } from "~/shared/menu";

export const AdminMenuPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useAdminMenuRouteParams();
  const tma = useTma();
  const { t } = useI18n();
  const { isLoading: isOrganizationsLoading, organization } = useAdminMenuOrganization(
    params.organizationId
  );
  const menuQuery = useAdminMenuQuery(organization?.id, tma.initDataRaw, tma.isReady);
  const [isUpdatingModule, setIsUpdatingModule] = React.useState(false);
  const [isUpdatingCurrency, setIsUpdatingCurrency] = React.useState(false);
  const [moduleError, setModuleError] = React.useState<string | null>(null);
  const [currencyError, setCurrencyError] = React.useState<string | null>(null);

  const backToOrganization = React.useCallback(() => {
    if (!params.organizationId) return;
    void navigate({ to: `/admin/${params.organizationId}` as never });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, backToOrganization);

  const payload = menuQuery.data;
  const menu = payload?.menu ?? null;
  const currencyCode = menu?.currency.code;
  const categories = React.useMemo(
    () => sortMenuEntities(menu?.categories ?? []),
    [menu?.categories]
  );
  const hasItems = categories.some((category) => category.items.length > 0);

  const updateModuleEnabled = React.useCallback(
    async (enabled: boolean) => {
      if (!organization || isUpdatingModule) return;

      setModuleError(null);
      setIsUpdatingModule(true);

      try {
        const updated = await updateAdminMenuEnabled(organization.id, enabled, tma.initDataRaw);
        setAdminMenuQueryData(queryClient, updated, tma.initDataRaw);
        setModuleError(null);
        tma.haptics.notification("success");
      } catch {
        setModuleError(t("admin.menu.errors.save"));
        tma.haptics.notification("error");
      } finally {
        setIsUpdatingModule(false);
      }
    },
    [isUpdatingModule, organization, queryClient, t, tma.haptics, tma.initDataRaw]
  );

  const updateCurrency = React.useCallback(
    async (nextCurrencyCode: MenuCurrencyCode) => {
      if (!organization || isUpdatingCurrency || nextCurrencyCode === currencyCode) return;

      setCurrencyError(null);
      setIsUpdatingCurrency(true);

      try {
        const updated = menu
          ? await updateAdminMenu(
              organization.id,
              { currencyCode: nextCurrencyCode },
              tma.initDataRaw
            )
          : await createAdminMenu(
              organization.id,
              {
                contentLocale: organization.locale,
                currencyCode: nextCurrencyCode
              },
              tma.initDataRaw
            );
        setAdminMenuQueryData(queryClient, updated, tma.initDataRaw);
        tma.haptics.notification("success");
      } catch (error) {
        setCurrencyError(
          error instanceof ApiError && error.status === 409
            ? t("admin.menu.currency.lockedHint")
            : t("admin.menu.errors.save")
        );
        tma.haptics.notification("error");
      } finally {
        setIsUpdatingCurrency(false);
      }
    },
    [
      currencyCode,
      isUpdatingCurrency,
      menu,
      organization,
      queryClient,
      t,
      tma.haptics,
      tma.initDataRaw
    ]
  );

  const goToCreateCategory = React.useCallback(() => {
    if (!params.organizationId) return;
    void navigate({ to: `/admin/${params.organizationId}/menu/categories/new` as never });
  }, [navigate, params.organizationId]);

  if ((isOrganizationsLoading && !organization) || (organization && menuQuery.isLoading)) {
    return <PendingScreen label={t("common.loading")} />;
  }

  if (!organization) {
    return (
      <AdminMenuStateScreen
        hint={t("admin.organizations.emptyHint")}
        title={t("admin.organizations.emptyTitle")}
      />
    );
  }

  if (menuQuery.isError || !payload) {
    return (
      <AdminMenuStateScreen
        actionLabel={t("admin.menu.actions.retry")}
        hint={t("admin.menu.errors.load")}
        title={t("admin.menu.title")}
        onAction={() => void menuQuery.refetch()}
      />
    );
  }

  const moduleHint =
    moduleError ??
    (payload.moduleEnabled && !organization.subscriptionActive
      ? t("admin.menu.module.subscriptionInactiveHint")
      : payload.moduleEnabled && !payload.guestAvailable
        ? t("admin.menu.module.notGuestAvailableHint")
        : t("admin.menu.module.hint"));
  const currencyHint =
    currencyError ??
    (hasItems ? t("admin.menu.currency.lockedHint") : t("admin.menu.currency.hint"));

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <MenuPageHeader hint={t("admin.menu.hint")} title={t("admin.menu.title")} />

          <List
            hint={moduleHint}
            items={[
              {
                addon: {
                  after: (
                    <Toggle
                      aria-label={t("admin.menu.module.toggle")}
                      checked={payload.moduleEnabled}
                      disabled={isUpdatingModule}
                      onCheckedChange={(enabled) => void updateModuleEnabled(enabled)}
                    />
                  ),
                  before: <MenuListIcon icon={BookOpen} tone="menu" />
                },
                isAction: false,
                title: t("admin.menu.module.toggle")
              }
            ]}
          />

          <List
            hint={currencyHint}
            items={[
              {
                addon: {
                  after: (
                    <MenuCurrencyPicker
                      disabled={hasItems || isUpdatingCurrency}
                      emptyLabel={t("admin.menu.currency.empty")}
                      placeholder={t("admin.menu.currency.select")}
                      searchPlaceholder={t("admin.menu.currency.searchPlaceholder")}
                      value={currencyCode}
                      onValueChange={(value) => void updateCurrency(value)}
                    />
                  ),
                  before: <MenuListIcon icon={Coins} tone="menu" />
                },
                isAction: false,
                title: t("admin.menu.currency.title")
              }
            ]}
          />

          <section className="grid gap-2.5">
            <List
              hint={
                !menu
                  ? t("admin.menu.categories.currencyRequiredHint")
                  : categories.length === 0
                    ? t("admin.menu.categories.emptyHint")
                    : undefined
              }
              items={[
                {
                  addon: {
                    before: <MenuListIcon icon={Plus} tone="add" />
                  },
                  disabled: !menu,
                  onClick: goToCreateCategory,
                  title: t("admin.menu.categories.add")
                }
              ]}
              title={t("admin.menu.categories.title")}
            />

            {categories.length > 0 ? (
              <List
                hint={t("admin.menu.categories.hint")}
                items={categories.map((category) => ({
                  addon: {
                    after: (
                      <MenuRowSuffix
                        hiddenLabel={t("admin.menu.status.hidden")}
                        isVisible={category.isVisible}
                      />
                    ),
                    before: <MenuListIcon icon={FolderOpen} tone="category" />
                  },
                  href: `/admin/${organization.id}/menu/categories/${category.id}`,
                  subtitle: t("admin.menu.categories.itemCount", {
                    count: category.items.length
                  }),
                  title: category.name
                }))}
              />
            ) : null}
          </section>
        </div>
      </main>
    </PageTransition>
  );
};
