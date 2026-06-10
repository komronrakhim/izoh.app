export const APP_LOCALES = ["ru", "uz"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export type PrismaAppLocale = Uppercase<AppLocale>;

export const DEFAULT_LOCALE: AppLocale = "ru";

export const LOCALE_STORAGE_KEY = "izoh.locale";

export const LOCALE_SOURCE_STORAGE_KEY = "izoh.localeSource";

export const MANUAL_LOCALE_SOURCE = "manual";

export const isSupportedLocale = (value: string | undefined | null): value is AppLocale =>
  Boolean(value && APP_LOCALES.includes(value as AppLocale));

export const normalizeAppLocale = (value: string | undefined | null): AppLocale => {
  if (!value) return DEFAULT_LOCALE;

  const normalized = value.toLowerCase().replace("_", "-").split("-")[0];

  return isSupportedLocale(normalized) ? normalized : DEFAULT_LOCALE;
};

export const toPrismaLocale = (locale: AppLocale): PrismaAppLocale =>
  locale.toUpperCase() as PrismaAppLocale;

export const fromPrismaLocale = (locale: string | undefined | null): AppLocale =>
  normalizeAppLocale(locale?.toLowerCase());
