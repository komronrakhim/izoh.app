import i18next, { type i18n, type TOptions } from "i18next";

import { DEFAULT_LOCALE, normalizeAppLocale, type AppLocale } from "./config";
import { i18nResources } from "./resources";

const instances = new Map<AppLocale, i18n>();

const getServerI18n = (locale: AppLocale) => {
  const normalizedLocale = normalizeAppLocale(locale);
  const cached = instances.get(normalizedLocale);

  if (cached) {
    return cached;
  }

  const instance = i18next.createInstance();

  void instance.init({
    fallbackLng: DEFAULT_LOCALE,
    initAsync: false,
    interpolation: {
      escapeValue: false
    },
    lng: normalizedLocale,
    resources: i18nResources,
    returnNull: false
  });

  instances.set(normalizedLocale, instance);

  return instance;
};

export const createTranslator = (locale: AppLocale) => {
  const instance = getServerI18n(locale);

  return (key: string, options?: TOptions) => instance.t(key, options);
};

export const translateArray = (locale: AppLocale, key: string): string[] => {
  const value = getServerI18n(locale).t(key, {
    returnObjects: true
  });

  return Array.isArray(value) ? value.map(String) : [];
};
