import { useParams } from "@tanstack/react-router";
import { ChevronRight, EyeOff, Search, Utensils, type LucideIcon } from "lucide-react";
import * as React from "react";

import { CoverSurface } from "~/common/components";
import {
  Badge,
  Button,
  Input,
  ListIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "~/common/ui";
import { cn } from "~/common/utils";
import { useAdminOrganization } from "~/shared/admin";
import type { AppLocale } from "~/shared/i18n";
import {
  MENU_CURRENCY_CODES,
  type MenuCurrency,
  type MenuCurrencyCode,
  type MenuItemPayload
} from "~/shared/menu";
import { PageTransition } from "~/shared/router/page-transition";

export type AdminMenuRouteParams = {
  categoryId?: string;
  itemId?: string;
  organizationId?: string;
};

export const useAdminMenuRouteParams = () => useParams({ strict: false }) as AdminMenuRouteParams;

export const useAdminMenuOrganization = (organizationId?: string) => {
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

  return { isLoading, organization };
};

type MenuIconTone =
  | "add"
  | "allergen"
  | "available"
  | "category"
  | "duplicate"
  | "menu"
  | "move"
  | "photo"
  | "spice"
  | "tag"
  | "visibility";

const menuIconToneClassNames: Record<MenuIconTone, string> = {
  add: "bg-[#34C759] text-white",
  allergen: "bg-[#FF3B30] text-white",
  available: "bg-[#34C759] text-white",
  category: "bg-[#5856D6] text-white",
  duplicate: "bg-[#32ADE6] text-white",
  menu: "bg-[#FF9500] text-white",
  move: "bg-[#0A84FF] text-white",
  photo: "bg-[#9B6DFF] text-white",
  spice: "bg-[#FF3B30] text-white",
  tag: "bg-[#00C7BE] text-white",
  visibility: "bg-[#AF52DE] text-white"
};

export const MenuListIcon = ({ icon: Icon, tone }: { icon: LucideIcon; tone: MenuIconTone }) => (
  <ListIcon className={menuIconToneClassNames[tone]}>
    <Icon size={15.5} strokeWidth={2.35} />
  </ListIcon>
);

export const MenuPageHeader = ({ hint, title }: { hint: string; title: string }) => (
  <section className="grid gap-2 px-4">
    <h1 className="ios-title-1 font-semibold tracking-normal text-foreground">{title}</h1>
    <p className="ios-footnote text-muted">{hint}</p>
  </section>
);

export const AdminMenuStateScreen = ({
  actionLabel,
  hint,
  onAction,
  title
}: {
  actionLabel?: string;
  hint: string;
  onAction?: () => void;
  title: string;
}) => (
  <PageTransition>
    <main className="tma-page bg-surface text-foreground">
      <div className="account-shell">
        <section className="grid justify-items-center gap-3 px-4 text-center">
          <div className="grid max-w-[380px] gap-2">
            <h1 className="ios-title-2 font-semibold tracking-normal text-foreground">{title}</h1>
            <p className="ios-footnote text-muted">{hint}</p>
          </div>
          {actionLabel && onAction ? (
            <Button size="sm" variant="secondary" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </section>
      </div>
    </main>
  </PageTransition>
);

export const MenuCurrencyPicker = ({
  disabled,
  emptyLabel,
  onValueChange,
  placeholder,
  searchPlaceholder,
  value
}: {
  disabled?: boolean;
  emptyLabel: string;
  onValueChange: (value: MenuCurrencyCode) => void;
  placeholder: string;
  searchPlaceholder: string;
  value?: MenuCurrencyCode;
}) => {
  const [search, setSearch] = React.useState("");
  const filteredCodes = React.useMemo(() => {
    const query = search.trim().toUpperCase();

    return query ? MENU_CURRENCY_CODES.filter((code) => code.includes(query)) : MENU_CURRENCY_CODES;
  }, [search]);

  return (
    <Select
      value={value}
      disabled={disabled}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
      onValueChange={(nextValue) => onValueChange(nextValue as MenuCurrencyCode)}
    >
      <SelectTrigger className="w-[142px] rounded-full" aria-label={value ?? placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        searchSlot={
          <Input
            addon={{ before: <Search size={15} strokeWidth={2.2} /> }}
            autoComplete="off"
            clearable
            placeholder={searchPlaceholder}
            size="xs"
            type="search"
            value={search}
            wide
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        }
        viewportClassName="max-h-64"
      >
        {filteredCodes.length > 0 ? (
          filteredCodes.map((code) => (
            <SelectItem key={code} value={code}>
              {code}
            </SelectItem>
          ))
        ) : (
          <div className="ios-footnote px-3 py-4 text-center text-muted">{emptyLabel}</div>
        )}
      </SelectContent>
    </Select>
  );
};

export const MenuOptionChips = <T extends string>({
  disabled = false,
  getLabel,
  onChange,
  options,
  selected
}: {
  disabled?: boolean;
  getLabel: (value: T) => string;
  onChange: (values: T[]) => void;
  options: readonly T[];
  selected: readonly T[];
}) => (
  <div className="flex flex-wrap gap-2 px-1">
    {options.map((option) => {
      const active = selected.includes(option);

      return (
        <button
          key={option}
          aria-pressed={active}
          className={cn(
            "ios-touch-target rounded-full border px-3.5 py-2 ios-footnote font-medium transition-[background-color,border-color,color,opacity,transform] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50",
            active
              ? "border-primary/24 bg-primary/12 text-primary"
              : "border-border/70 bg-surface-2 text-muted hover:bg-surface-3"
          )}
          disabled={disabled}
          type="button"
          onClick={() =>
            onChange(active ? selected.filter((value) => value !== option) : [...selected, option])
          }
        >
          {getLabel(option)}
        </button>
      );
    })}
  </div>
);

export const MenuItemCover = ({
  className,
  item,
  name,
  photoUrl
}: {
  className?: string;
  item?: MenuItemPayload | null;
  name?: string;
  photoUrl?: string | null;
}) => {
  const resolvedName = name?.trim() || item?.name || "menu-item";
  const resolvedPhotoUrl = photoUrl === undefined ? item?.photoUrl : photoUrl;
  const seed = item?.id ?? resolvedName;

  return (
    <CoverSurface
      alt={resolvedName}
      className={cn(
        "grid shrink-0 place-items-center rounded-[18px] ring-1 ring-border/60",
        className
      )}
      imageClassName="object-cover"
      seed={seed}
      src={resolvedPhotoUrl}
    >
      {!resolvedPhotoUrl ? (
        <span className="grid size-10 place-items-center rounded-full bg-black/12 text-white backdrop-blur-sm">
          <Utensils size={20} strokeWidth={2.1} />
        </span>
      ) : null}
    </CoverSurface>
  );
};

export const MenuRowSuffix = ({
  available = true,
  hiddenLabel,
  isVisible = true,
  unavailableLabel
}: {
  available?: boolean;
  hiddenLabel: string;
  isVisible?: boolean;
  unavailableLabel?: string;
}) => (
  <span className="inline-flex shrink-0 items-center gap-1.5">
    {!isVisible ? (
      <Badge className="gap-1" variant="neutral">
        <EyeOff size={12} strokeWidth={2.35} />
        {hiddenLabel}
      </Badge>
    ) : !available && unavailableLabel ? (
      <Badge variant="warning">{unavailableLabel}</Badge>
    ) : null}
    <ChevronRight aria-hidden="true" className="text-muted/84" size={17} />
  </span>
);

// Array#sort is stable in supported runtimes, preserving the server's created_at tie-break.
export const sortMenuEntities = <T extends { id: string; sortOrder: number }>(
  items: readonly T[]
) => [...items].sort((a, b) => a.sortOrder - b.sortOrder);

export const formatMenuPrice = (
  priceMinor: number,
  currency: MenuCurrency,
  locale: AppLocale | string
) => {
  const divisor = 10 ** currency.minorUnit;

  try {
    return new Intl.NumberFormat(locale, {
      currency: currency.code,
      maximumFractionDigits: currency.minorUnit,
      minimumFractionDigits: currency.minorUnit,
      style: "currency"
    }).format(priceMinor / divisor);
  } catch {
    return `${priceMinor / divisor} ${currency.code}`;
  }
};

export const priceMinorToInput = (priceMinor: number, minorUnit: number) =>
  minorUnit === 0 ? String(priceMinor) : (priceMinor / 10 ** minorUnit).toFixed(minorUnit);

export const parsePriceMinor = (value: string, minorUnit: number) => {
  const normalized = value.trim().replace(/\s+/gu, "").replace(",", ".");
  const expression =
    minorUnit === 0 ? /^\d+$/u : new RegExp(`^\\d+(?:\\.\\d{0,${minorUnit}})?$`, "u");

  if (!normalized || !expression.test(normalized)) {
    return null;
  }

  const priceMinor = Math.round(Number(normalized) * 10 ** minorUnit);

  return Number.isSafeInteger(priceMinor) && priceMinor >= 0 && priceMinor <= 2_000_000_000
    ? priceMinor
    : null;
};
