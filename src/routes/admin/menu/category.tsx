import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Input, List, PendingScreen, Toggle } from "~/common/ui";
import { useI18n } from "~/shared/i18n/react";
import { MENU_NAME_MAX_LENGTH } from "~/shared/menu";
import { PageTransition } from "~/shared/router/page-transition";
import { showTmaPopup, useTma, useTmaBackButton, useTmaMainButton } from "~/shared/tma";

import {
  createAdminMenuCategory,
  createMenuClientRequestId,
  deleteAdminMenuCategory,
  reorderAdminMenuCategories,
  setAdminMenuQueryData,
  updateAdminMenuCategory,
  useAdminMenuQuery
} from "./api";
import {
  AdminMenuStateScreen,
  formatMenuPrice,
  MenuItemCover,
  MenuListIcon,
  MenuPageHeader,
  MenuRowSuffix,
  sortMenuEntities,
  useAdminMenuOrganization,
  useAdminMenuRouteParams
} from "./components";

const CategoryFields = ({
  isBusy,
  isVisible,
  name,
  onNameChange,
  onVisibilityChange,
  t
}: {
  isBusy: boolean;
  isVisible: boolean;
  name: string;
  onNameChange: (value: string) => void;
  onVisibilityChange: (value: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) => (
  <>
    <Input
      autoFocus
      clearLabel={t("common.actions.clear")}
      disabled={isBusy}
      maxLength={MENU_NAME_MAX_LENGTH}
      placeholder={t("admin.menu.categories.fields.namePlaceholder")}
      value={name}
      wide
      onChange={(event) => onNameChange(event.target.value)}
    />
    <List
      hint={t("admin.menu.categories.fields.visibilityHint")}
      items={[
        {
          addon: {
            after: (
              <Toggle
                aria-label={t("admin.menu.categories.fields.visible")}
                checked={isVisible}
                disabled={isBusy}
                onCheckedChange={onVisibilityChange}
              />
            ),
            before: <MenuListIcon icon={Eye} tone="visibility" />
          },
          isAction: false,
          title: t("admin.menu.categories.fields.visible")
        }
      ]}
    />
  </>
);

export const AdminMenuCategoryCreatePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useAdminMenuRouteParams();
  const tma = useTma();
  const { t } = useI18n();
  const { isLoading: isOrganizationsLoading, organization } = useAdminMenuOrganization(
    params.organizationId
  );
  const menuQuery = useAdminMenuQuery(organization?.id, tma.initDataRaw, tma.isReady);
  const [name, setName] = React.useState("");
  const [isVisible, setIsVisible] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const clientRequestIdRef = React.useRef(createMenuClientRequestId("menu-category"));

  const backToMenu = React.useCallback(() => {
    if (!params.organizationId) return;
    void navigate({ to: `/admin/${params.organizationId}/menu` as never });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, backToMenu);

  const saveCategory = React.useCallback(async () => {
    const cleanName = name.trim();

    if (!organization || !menuQuery.data?.menu || !cleanName || isSaving) return;

    setError(null);
    setIsSaving(true);

    try {
      const currentPayload = menuQuery.data;
      const previousIds = new Set(
        currentPayload.menu?.categories.map((category) => category.id) ?? []
      );
      const categories = sortMenuEntities(currentPayload.menu?.categories ?? []);
      const sortOrder = (categories.at(-1)?.sortOrder ?? -1) + 1;
      const updated = await createAdminMenuCategory(
        organization.id,
        {
          clientRequestId: clientRequestIdRef.current,
          isVisible,
          name: cleanName,
          sortOrder
        },
        tma.initDataRaw
      );
      setAdminMenuQueryData(queryClient, updated, tma.initDataRaw);
      tma.haptics.notification("success");

      const createdCategory = updated.menu?.categories.find(
        (category) => !previousIds.has(category.id)
      );

      if (createdCategory) {
        void navigate({
          replace: true,
          to: `/admin/${organization.id}/menu/categories/${createdCategory.id}` as never
        });
      } else {
        backToMenu();
      }
    } catch {
      setError(t("admin.menu.errors.save"));
      tma.haptics.notification("error");
    } finally {
      setIsSaving(false);
    }
  }, [
    backToMenu,
    isSaving,
    isVisible,
    menuQuery.data,
    name,
    navigate,
    organization,
    queryClient,
    t,
    tma.haptics,
    tma.initDataRaw
  ]);

  const canSave =
    Boolean(name.trim()) && Boolean(organization) && Boolean(menuQuery.data?.menu) && !isSaving;
  const mainButtonState = React.useMemo(
    () =>
      organization
        ? {
            enabled: canSave,
            loading: isSaving,
            shine: canSave,
            text: t("admin.menu.categories.createAction")
          }
        : null,
    [canSave, isSaving, organization, t]
  );

  useTmaMainButton(mainButtonState, saveCategory);

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

  if (menuQuery.isError) {
    return (
      <AdminMenuStateScreen
        actionLabel={t("admin.menu.actions.retry")}
        hint={t("admin.menu.errors.load")}
        title={t("admin.menu.categories.createTitle")}
        onAction={() => void menuQuery.refetch()}
      />
    );
  }

  if (!menuQuery.data?.menu) {
    return (
      <AdminMenuStateScreen
        actionLabel={t("admin.menu.actions.back")}
        hint={t("admin.menu.categories.currencyRequiredHint")}
        title={t("admin.menu.categories.createTitle")}
        onAction={backToMenu}
      />
    );
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <form
          className="account-shell"
          onSubmit={(event) => {
            event.preventDefault();
            void saveCategory();
          }}
        >
          <MenuPageHeader
            hint={t("admin.menu.categories.createHint")}
            title={t("admin.menu.categories.createTitle")}
          />
          <CategoryFields
            isBusy={isSaving}
            isVisible={isVisible}
            name={name}
            t={t}
            onNameChange={setName}
            onVisibilityChange={setIsVisible}
          />
          {error ? <p className="ios-footnote px-4 text-danger">{error}</p> : null}
        </form>
      </main>
    </PageTransition>
  );
};

export const AdminMenuCategoryPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useAdminMenuRouteParams();
  const tma = useTma();
  const { locale, t } = useI18n();
  const { isLoading: isOrganizationsLoading, organization } = useAdminMenuOrganization(
    params.organizationId
  );
  const menuQuery = useAdminMenuQuery(organization?.id, tma.initDataRaw, tma.isReady);
  const menu = menuQuery.data?.menu ?? null;
  const categories = React.useMemo(
    () => sortMenuEntities(menu?.categories ?? []),
    [menu?.categories]
  );
  const category = categories.find((item) => item.id === params.categoryId) ?? null;
  const categoryIndex = category ? categories.findIndex((item) => item.id === category.id) : -1;
  const items = React.useMemo(() => sortMenuEntities(category?.items ?? []), [category?.items]);
  const [name, setName] = React.useState("");
  const [isVisible, setIsVisible] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isActing, setIsActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!category) return;
    setName(category.name);
    setIsVisible(category.isVisible);
  }, [category?.id, category?.isVisible, category?.name]);

  const backToMenu = React.useCallback(() => {
    if (!params.organizationId) return;
    void navigate({ to: `/admin/${params.organizationId}/menu` as never });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, backToMenu);

  const cachePayload = React.useCallback(
    (payload: NonNullable<typeof menuQuery.data>) =>
      setAdminMenuQueryData(queryClient, payload, tma.initDataRaw),
    [queryClient, tma.initDataRaw]
  );

  const saveCategory = React.useCallback(async () => {
    const cleanName = name.trim();

    if (!organization || !category || !cleanName || isSaving || isActing) return;

    setError(null);
    setIsSaving(true);

    try {
      const updated = await updateAdminMenuCategory(
        organization.id,
        category.id,
        { isVisible, name: cleanName },
        tma.initDataRaw
      );
      cachePayload(updated);
      tma.haptics.notification("success");
    } catch {
      setError(t("admin.menu.errors.save"));
      tma.haptics.notification("error");
    } finally {
      setIsSaving(false);
    }
  }, [
    cachePayload,
    category,
    isActing,
    isSaving,
    isVisible,
    name,
    organization,
    t,
    tma.haptics,
    tma.initDataRaw
  ]);

  const moveCategory = React.useCallback(
    async (direction: "down" | "up") => {
      if (!organization || !category || isSaving || isActing) return;
      const neighbor = categories[categoryIndex + (direction === "up" ? -1 : 1)];
      if (!neighbor) return;

      setError(null);
      setIsActing(true);

      try {
        const orderedIds = categories.map((candidate) => candidate.id);
        [orderedIds[categoryIndex], orderedIds[categoryIndex + (direction === "up" ? -1 : 1)]] = [
          neighbor.id,
          category.id
        ];
        const updated = await reorderAdminMenuCategories(
          organization.id,
          { orderedIds },
          tma.initDataRaw
        );
        cachePayload(updated);
        tma.haptics.notification("success");
      } catch {
        setError(t("admin.menu.errors.save"));
        tma.haptics.notification("error");
      } finally {
        setIsActing(false);
      }
    },
    [
      cachePayload,
      categories,
      category,
      categoryIndex,
      isActing,
      isSaving,
      organization,
      t,
      tma.haptics,
      tma.initDataRaw
    ]
  );

  const deleteCategory = React.useCallback(async () => {
    if (!organization || !category || isSaving || isActing) return;

    const buttonId = await showTmaPopup({
      buttons: [
        { id: "delete", text: t("admin.menu.categories.deleteConfirm"), type: "destructive" },
        { id: "cancel", type: "cancel" }
      ],
      message: t("admin.menu.categories.deleteMessage"),
      title: t("admin.menu.categories.deleteTitle")
    });

    if (buttonId !== "delete") return;

    setIsActing(true);

    try {
      const updated = await deleteAdminMenuCategory(organization.id, category.id, tma.initDataRaw);
      cachePayload(updated);
      tma.haptics.notification("success");
      backToMenu();
    } catch {
      setError(t("admin.menu.errors.delete"));
      tma.haptics.notification("error");
    } finally {
      setIsActing(false);
    }
  }, [
    backToMenu,
    cachePayload,
    category,
    isActing,
    isSaving,
    organization,
    t,
    tma.haptics,
    tma.initDataRaw
  ]);

  const goToCreateItem = React.useCallback(() => {
    if (!organization || !category) return;
    void navigate({
      to: `/admin/${organization.id}/menu/categories/${category.id}/items/new` as never
    });
  }, [category, navigate, organization]);

  const canSave = Boolean(category) && Boolean(name.trim()) && !isSaving && !isActing;
  const mainButtonState = React.useMemo(
    () =>
      category
        ? {
            enabled: canSave,
            loading: isSaving,
            shine: canSave,
            text: t("admin.menu.categories.saveAction")
          }
        : null,
    [canSave, category, isSaving, t]
  );

  useTmaMainButton(mainButtonState, saveCategory);

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

  if (menuQuery.isError) {
    return (
      <AdminMenuStateScreen
        actionLabel={t("admin.menu.actions.retry")}
        hint={t("admin.menu.errors.load")}
        title={t("admin.menu.categories.editTitle")}
        onAction={() => void menuQuery.refetch()}
      />
    );
  }

  if (!menu) {
    return (
      <AdminMenuStateScreen
        actionLabel={t("admin.menu.actions.back")}
        hint={t("admin.menu.categories.currencyRequiredHint")}
        title={t("admin.menu.categories.editTitle")}
        onAction={backToMenu}
      />
    );
  }

  if (!category) {
    return (
      <AdminMenuStateScreen
        actionLabel={t("admin.menu.actions.back")}
        hint={t("admin.menu.categories.notFoundHint")}
        title={t("admin.menu.categories.notFoundTitle")}
        onAction={backToMenu}
      />
    );
  }

  const isBusy = isSaving || isActing;

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <form
          className="account-shell"
          onSubmit={(event) => {
            event.preventDefault();
            void saveCategory();
          }}
        >
          <MenuPageHeader
            hint={t("admin.menu.categories.editHint")}
            title={name.trim() || t("admin.menu.categories.editTitle")}
          />
          <CategoryFields
            isBusy={isBusy}
            isVisible={isVisible}
            name={name}
            t={t}
            onNameChange={setName}
            onVisibilityChange={setIsVisible}
          />

          <section className="grid gap-2.5">
            <List
              hint={items.length === 0 ? t("admin.menu.items.emptyHint") : undefined}
              items={[
                {
                  addon: { before: <MenuListIcon icon={Plus} tone="add" /> },
                  onClick: goToCreateItem,
                  title: t("admin.menu.items.add")
                }
              ]}
              title={t("admin.menu.items.title")}
            />

            {items.length > 0 ? (
              <List
                hint={t("admin.menu.items.hint")}
                items={items.map((item) => ({
                  addon: {
                    after: (
                      <MenuRowSuffix
                        available={item.isAvailable}
                        hiddenLabel={t("admin.menu.status.hidden")}
                        isVisible={item.isVisible}
                        unavailableLabel={t("admin.menu.status.soldOut")}
                      />
                    ),
                    before: <MenuItemCover className="size-14" item={item} />
                  },
                  href: `/admin/${organization.id}/menu/categories/${category.id}/items/${item.id}`,
                  separatorInsetClassName: "ml-[84px]",
                  spacing: "md" as const,
                  subtitle: [
                    formatMenuPrice(item.priceMinor, menu.currency, locale),
                    item.portionLabel
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  title: item.name
                }))}
              />
            ) : null}
          </section>

          <List
            items={[
              {
                addon: { before: <MenuListIcon icon={ArrowUp} tone="move" /> },
                disabled: categoryIndex <= 0 || isBusy,
                onClick: () => void moveCategory("up"),
                title: t("admin.menu.actions.moveUp")
              },
              {
                addon: { before: <MenuListIcon icon={ArrowDown} tone="move" /> },
                disabled: categoryIndex < 0 || categoryIndex >= categories.length - 1 || isBusy,
                onClick: () => void moveCategory("down"),
                title: t("admin.menu.actions.moveDown")
              },
              {
                addon: { before: <MenuListIcon icon={Trash2} tone="allergen" /> },
                disabled: isBusy,
                onClick: () => void deleteCategory(),
                title: t("admin.menu.categories.deleteAction"),
                variant: "destructive"
              }
            ]}
          />

          {error ? <p className="ios-footnote px-4 text-danger">{error}</p> : null}
        </form>
      </main>
    </PageTransition>
  );
};
