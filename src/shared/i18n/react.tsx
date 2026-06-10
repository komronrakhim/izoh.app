import * as React from "react";
import i18next, { type TOptions } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";

import {
  DEFAULT_LOCALE,
  LOCALE_SOURCE_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  MANUAL_LOCALE_SOURCE,
  normalizeAppLocale,
  type AppLocale
} from "./config";
import { i18nResources } from "./resources";
import { getTmaLaunchContext, getTmaUserLanguageCode } from "~/shared/tma";

type TranslateFn = (key: string, options?: TOptions) => string;

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: TranslateFn;
  tArray: (key: string) => string[];
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

let didInitClientI18n = false;

const ensureClientI18n = (locale: AppLocale) => {
  if (!didInitClientI18n) {
    didInitClientI18n = true;

    void i18next.use(initReactI18next).init({
      fallbackLng: DEFAULT_LOCALE,
      initAsync: false,
      interpolation: {
        escapeValue: false
      },
      lng: locale,
      resources: i18nResources,
      returnNull: false
    });
  }

  return i18next;
};

const getInitialLocale = () => {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  const storedSource = window.localStorage.getItem(LOCALE_SOURCE_STORAGE_KEY);

  if (storedSource === MANUAL_LOCALE_SOURCE && storedLocale) {
    return normalizeAppLocale(storedLocale);
  }

  const telegramLanguageCode = getTmaUserLanguageCode();

  return normalizeAppLocale(telegramLanguageCode ?? window.navigator.language);
};

const syncManualUserLocale = (locale: AppLocale) => {
  const { initDataRaw } = getTmaLaunchContext();

  if (!initDataRaw) {
    return;
  }

  void fetch("/api/tma/locale", {
    body: JSON.stringify({
      initData: initDataRaw,
      locale
    }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  }).catch(() => {
    // Locale is already persisted locally; backend sync is retried on the next manual change.
  });
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = React.useState<AppLocale>(getInitialLocale);
  const i18n = React.useMemo(() => ensureClientI18n(locale), [locale]);

  const setLocale = React.useCallback((nextLocale: AppLocale) => {
    void i18next.changeLanguage(nextLocale);
    setLocaleState(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    window.localStorage.setItem(LOCALE_SOURCE_STORAGE_KEY, MANUAL_LOCALE_SOURCE);
    document.documentElement.lang = nextLocale;
    syncManualUserLocale(nextLocale);
  }, []);

  React.useEffect(() => {
    void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [i18n, locale]);

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: i18n.t.bind(i18n) as TranslateFn,
      tArray: (key) => {
        const value = i18n.t(key, {
          returnObjects: true
        });

        return Array.isArray(value) ? value.map(String) : [];
      }
    }),
    [i18n, locale, setLocale]
  );

  return (
    <I18nextProvider i18n={i18n}>
      <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    </I18nextProvider>
  );
};

export const useI18n = () => {
  const context = React.useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
};
