import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Utensils } from "lucide-react";
import * as React from "react";

import { CoverSurface } from "~/common/components";
import { Badge, BottomSheet, Button, List, Spinner, Tabs } from "~/common/ui";
import { cn, hasImageUrl } from "~/common/utils";
import { fetchApiJson } from "~/shared/api";
import { useI18n } from "~/shared/i18n/react";
import type { GuestMenuPayload } from "~/shared/menu";
import { hideTmaMainButtonNow, useTma, useTmaBackButton, useTmaMainButton } from "~/shared/tma";

import { WizardEmptyState, WizardHeader, WizardPoweredBy } from "../module/components";
import { useCustomerWizard } from "../module/context";

type GuestMenu = GuestMenuPayload["menu"];
type GuestMenuCategory = GuestMenu["categories"][number];
type GuestMenuItem = GuestMenuCategory["items"][number];
type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];
type ItemBadge = {
  id: string;
  label: string;
  variant: BadgeVariant;
};

const normalizeCode = (code: string) => code.trim().toLowerCase();

const formatPrice = ({
  code,
  locale,
  minorUnit,
  priceMinor
}: {
  code: string;
  locale: string;
  minorUnit: number;
  priceMinor: number;
}) => {
  const value = priceMinor / 10 ** minorUnit;

  try {
    return new Intl.NumberFormat(locale, {
      currency: code,
      maximumFractionDigits: minorUnit,
      minimumFractionDigits: minorUnit,
      style: "currency"
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: minorUnit,
      minimumFractionDigits: minorUnit
    }).format(value)} ${code}`;
  }
};

const getItemBadges = (item: GuestMenuItem, t: ReturnType<typeof useI18n>["t"]): ItemBadge[] => {
  return [
    ...(item.spiceLevel > 0
      ? [
          {
            id: `spice:${item.spiceLevel}`,
            label: t(`customer.menu.spiceLevels.${item.spiceLevel}`),
            variant: "danger" as const
          }
        ]
      : []),
    ...item.dietaryTagCodes.map((code) => {
      const normalizedCode = normalizeCode(code);

      return {
        id: `dietary:${normalizedCode}`,
        label: t(`customer.menu.dietaryTags.${normalizedCode}`),
        variant: "success" as const
      };
    }),
    ...item.marketingTagCodes.map((code) => {
      const normalizedCode = normalizeCode(code);

      return {
        id: `marketing:${normalizedCode}`,
        label: t(`customer.menu.marketingTags.${normalizedCode}`),
        variant: "info" as const
      };
    })
  ];
};

const MenuItemCover = ({
  item,
  size = "row"
}: {
  item: GuestMenuItem;
  size?: "detail" | "row";
}) => {
  const showImage = hasImageUrl(item.photoUrl);

  return (
    <CoverSurface
      alt={item.name}
      className={cn(
        size === "row" ? "size-[72px] rounded-[20px]" : "aspect-[4/3] w-full rounded-[30px]",
        !item.isAvailable && "opacity-[0.55] saturate-50"
      )}
      imageClassName="transition-opacity"
      seed={`${item.id}:${item.name}`}
      src={item.photoUrl}
    >
      {!showImage ? (
        <span className="absolute inset-0 grid place-items-center text-white/80">
          <Utensils aria-hidden="true" className={size === "row" ? "size-6" : "size-12"} />
        </span>
      ) : null}
    </CoverSurface>
  );
};

const MenuItemBadges = ({ badges }: { badges: ItemBadge[] }) =>
  badges.length > 0 ? (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <Badge key={badge.id} variant={badge.variant}>
          {badge.label}
        </Badge>
      ))}
    </span>
  ) : null;

const MenuItemList = ({
  category,
  currency,
  locale,
  onSelectItem,
  t
}: {
  category: GuestMenuCategory;
  currency: GuestMenu["currency"];
  locale: string;
  onSelectItem: (item: GuestMenuItem) => void;
  t: ReturnType<typeof useI18n>["t"];
}) => (
  <List
    className="rounded-[28px]"
    items={category.items.map((item) => {
      const itemBadges = getItemBadges(item, t);
      const visibleBadges: ItemBadge[] = [
        ...(!item.isAvailable
          ? [
              {
                id: "availability",
                label: t("customer.menu.item.unavailable"),
                variant: "neutral" as const
              }
            ]
          : []),
        ...itemBadges
      ].slice(0, 2);
      const formattedPrice = formatPrice({
        code: currency.code,
        locale,
        minorUnit: currency.minorUnit,
        priceMinor: item.priceMinor
      });

      return {
        addon: {
          after: (
            <span
              className={cn(
                "grid shrink-0 justify-items-end gap-1 pl-2",
                !item.isAvailable && "opacity-[0.55]"
              )}
            >
              <span className="ios-subhead whitespace-nowrap font-semibold text-foreground">
                {formattedPrice}
              </span>
              <ChevronRight aria-hidden="true" size={17} strokeWidth={2.15} />
            </span>
          ),
          before: <MenuItemCover item={item} />
        },
        onClick: () => onSelectItem(item),
        spacing: "md" as const,
        title: (
          <span className={cn("grid min-w-0", !item.isAvailable && "opacity-[0.55]")}>
            <span className="line-clamp-2 font-medium leading-snug">{item.name}</span>
            {item.portionLabel ? (
              <span className="ios-caption-1 mt-0.5 text-muted">{item.portionLabel}</span>
            ) : null}
            <MenuItemBadges badges={visibleBadges} />
          </span>
        )
      };
    })}
    separatorInsetClassName="ml-[104px]"
    spacing="md"
  />
);

const MenuItemSheet = ({
  currency,
  item,
  locale,
  onOpenChange,
  open,
  t
}: {
  currency: GuestMenu["currency"];
  item: GuestMenuItem | null;
  locale: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) => {
  if (!item) {
    return null;
  }

  const itemBadges = getItemBadges(item, t);
  const formattedPrice = formatPrice({
    code: currency.code,
    locale,
    minorUnit: currency.minorUnit,
    priceMinor: item.priceMinor
  });

  return (
    <BottomSheet
      closeLabel={t("common.actions.close")}
      contentClassName="max-h-[calc(100svh-150px)] overflow-y-auto overscroll-contain"
      description={[item.portionLabel, formattedPrice].filter(Boolean).join(" · ")}
      open={open}
      title={item.name}
      onOpenChange={onOpenChange}
    >
      <div className="grid gap-5 pb-1">
        <MenuItemCover item={item} size="detail" />

        {!item.isAvailable ? (
          <Badge className="justify-self-start" variant="neutral" size="md">
            {t("customer.menu.item.unavailable")}
          </Badge>
        ) : null}

        {item.description ? (
          <p className="ios-body whitespace-pre-wrap text-foreground">{item.description}</p>
        ) : null}

        {itemBadges.length > 0 ? (
          <section className="grid gap-2.5">
            <h3 className="ios-caption-1 font-semibold uppercase text-muted">
              {t("customer.menu.details.tagsTitle")}
            </h3>
            <MenuItemBadges badges={itemBadges} />
          </section>
        ) : null}

        {item.allergenCodes.length > 0 ? (
          <section className="grid gap-2.5 rounded-[24px] bg-warning/10 p-4 ring-1 ring-warning/12">
            <h3 className="ios-subhead flex items-center gap-2 font-semibold text-foreground">
              <AlertTriangle aria-hidden="true" className="text-warning" size={18} />
              {t("customer.menu.details.allergensTitle")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {item.allergenCodes.map((code) => {
                const normalizedCode = normalizeCode(code);

                return (
                  <Badge key={normalizedCode} variant="warning">
                    {t(`customer.menu.allergens.${normalizedCode}`)}
                  </Badge>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </BottomSheet>
  );
};

export const CustomerMenuPage = () => {
  const wizard = useCustomerWizard();
  const { locale, t } = useI18n();
  const tma = useTma();
  const menuAvailable = Boolean(wizard.guestEntryConfig?.menu?.available);
  const startParam = wizard.guestEntryConfig?.startParam ?? "";
  const menuQuery = useQuery({
    enabled: menuAvailable && Boolean(startParam),
    queryFn: () =>
      fetchApiJson<GuestMenuPayload>(`/api/guest-entry/${encodeURIComponent(startParam)}/menu`, {
        initDataRaw: tma.initDataRaw
      }),
    queryKey: ["guest-entry", startParam, "menu", tma.initDataRaw]
  });
  const categories = menuQuery.data?.menu.categories ?? [];
  const [activeCategoryId, setActiveCategoryId] = React.useState("");
  const [selectedItem, setSelectedItem] = React.useState<GuestMenuItem | null>(null);
  const activeCategory =
    categories.find((category) => category.id === activeCategoryId) ?? categories[0];
  const hasFeedbackChoices = wizard.choices.length > 0;

  React.useLayoutEffect(() => {
    hideTmaMainButtonNow();
  }, []);

  React.useEffect(() => {
    if (!activeCategoryId || !categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(categories[0]?.id ?? "");
    }
  }, [activeCategoryId, categories]);

  React.useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const currentItem = categories
      .flatMap((category) => category.items)
      .find((item) => item.id === selectedItem.id);

    if (!currentItem) {
      setSelectedItem(null);
    } else if (currentItem !== selectedItem) {
      setSelectedItem(currentItem);
    }
  }, [categories, selectedItem]);

  React.useEffect(() => {
    if (wizard.guestEntryConfig && !menuAvailable) {
      wizard.goToChoice({
        replace: true
      });
    }
  }, [menuAvailable, wizard]);

  const leaveMenu = React.useCallback(() => {
    setSelectedItem(null);
    wizard.goToChoice();
  }, [wizard]);

  useTmaBackButton(true, () => {
    if (selectedItem) {
      setSelectedItem(null);
      return;
    }

    leaveMenu();
  });
  useTmaMainButton(null, () => undefined);

  if (!wizard.guestEntryConfig || !menuAvailable) {
    return null;
  }

  return (
    <>
      <WizardHeader
        avatarSeed={wizard.guestEntryConfig.organization.id}
        logoUrl={wizard.guestEntryConfig.organization.logoUrl ?? undefined}
        organizationName={wizard.organizationName ?? wizard.guestEntryConfig.organization.name}
        qrContext={
          wizard.guestEntryConfig.qrContext
            ? t("customer.qrContext", {
                context: wizard.guestEntryConfig.qrContext
              })
            : undefined
        }
      />

      <div className="grid flex-1 content-start gap-5 pt-1">
        <header className="grid gap-1 px-1">
          <h1 className="ios-title-1 font-semibold text-foreground">{t("customer.menu.title")}</h1>
          <p className="ios-footnote text-muted">{t("customer.menu.subtitle")}</p>
        </header>

        {menuQuery.isLoading ? (
          <div
            aria-label={t("common.loading")}
            className="grid min-h-40 place-items-center text-primary"
            role="status"
          >
            <Spinner size={19} />
          </div>
        ) : menuQuery.isError ? (
          <div className="grid gap-3">
            <WizardEmptyState
              subtitle={t("customer.menu.error.subtitle")}
              title={t("customer.menu.error.title")}
            />
            <Button
              state={menuQuery.isFetching ? "loading" : "idle"}
              variant="secondary"
              wide
              onClick={() => {
                void menuQuery.refetch();
              }}
            >
              {t("customer.menu.error.action")}
            </Button>
          </div>
        ) : !menuQuery.data || categories.length === 0 ? (
          <WizardEmptyState
            subtitle={t("customer.menu.empty.subtitle")}
            title={t("customer.menu.empty.title")}
          />
        ) : (
          <div className="grid gap-4">
            <Tabs
              className="[&>button]:flex-none [&>button]:shrink-0"
              compact
              items={categories.map((category) => ({
                label: category.name,
                value: category.id
              }))}
              value={activeCategory?.id ?? ""}
              onValueChange={setActiveCategoryId}
            />

            {activeCategory ? (
              <MenuItemList
                category={activeCategory}
                currency={menuQuery.data.menu.currency}
                locale={locale}
                t={t}
                onSelectItem={setSelectedItem}
              />
            ) : null}
          </div>
        )}

        {hasFeedbackChoices ? (
          <footer className="grid justify-items-center gap-1.5 px-4 py-4 text-center">
            <p className="ios-footnote text-muted">{t("customer.menu.footer.title")}</p>
            <Button size="sm" variant="text" onClick={leaveMenu}>
              {t("customer.menu.footer.action")}
            </Button>
          </footer>
        ) : null}
      </div>

      <WizardPoweredBy label={t("common.poweredBy")} />

      {menuQuery.data ? (
        <MenuItemSheet
          currency={menuQuery.data.menu.currency}
          item={selectedItem}
          locale={locale}
          open={Boolean(selectedItem)}
          t={t}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedItem(null);
            }
          }}
        />
      ) : null}
    </>
  );
};
