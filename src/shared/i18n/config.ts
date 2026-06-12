export const APP_LOCALES = ["ru", "uz", "en", "tr", "kk", "ky", "tg", "az", "uk"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "ru";

export const APP_INTL_LOCALE_BY_LOCALE = {
  az: "az-AZ",
  en: "en-US",
  kk: "kk-KZ",
  ky: "ky-KG",
  ru: "ru-RU",
  tg: "tg-TJ",
  tr: "tr-TR",
  uk: "uk-UA",
  uz: "uz-UZ"
} satisfies Record<AppLocale, string>;

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

export const toPrismaLocale = (locale: AppLocale): AppLocale => locale;

export const fromPrismaLocale = (locale: string | undefined | null): AppLocale =>
  normalizeAppLocale(locale);

export const getIntlLocale = (locale: string | undefined | null) =>
  APP_INTL_LOCALE_BY_LOCALE[normalizeAppLocale(locale)];
