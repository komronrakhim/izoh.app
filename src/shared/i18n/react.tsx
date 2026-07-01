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
import { loadClientI18nMessages } from "./client-resources";
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
let clientI18nInitPromise: Promise<typeof i18next> | null = null;
const loadedLocales = new Set<AppLocale>();

const loadLocaleIntoI18n = async (locale: AppLocale) => {
  if (loadedLocales.has(locale)) {
    return;
  }

  const messages = await loadClientI18nMessages(locale);

  i18next.addResourceBundle(locale, "translation", messages, true, true);
  loadedLocales.add(locale);
};

const initializeClientI18n = (locale: AppLocale) => {
  if (!clientI18nInitPromise) {
    clientI18nInitPromise = (async () => {
      const fallbackMessages = await loadClientI18nMessages(DEFAULT_LOCALE);
      const localeMessages =
        locale === DEFAULT_LOCALE ? fallbackMessages : await loadClientI18nMessages(locale);

      await i18next.use(initReactI18next).init({
        fallbackLng: DEFAULT_LOCALE,
        initAsync: false,
        interpolation: {
          escapeValue: false
        },
        lng: locale,
        resources: {
          [DEFAULT_LOCALE]: {
            translation: fallbackMessages
          },
          ...(locale === DEFAULT_LOCALE
            ? {}
            : {
                [locale]: {
                  translation: localeMessages
                }
              })
        },
        returnNull: false
      });

      didInitClientI18n = true;
      loadedLocales.add(DEFAULT_LOCALE);
      loadedLocales.add(locale);

      return i18next;
    })().catch((error: unknown) => {
      clientI18nInitPromise = null;
      throw error;
    });
  }

  return clientI18nInitPromise;
};

const ensureClientI18n = async (locale: AppLocale) => {
  if (!didInitClientI18n) {
    const instance = await initializeClientI18n(locale);

    if (instance.language !== locale) {
      await loadLocaleIntoI18n(locale);
      await instance.changeLanguage(locale);
    }

    return instance;
  }

  if (!clientI18nInitPromise) {
    clientI18nInitPromise = Promise.resolve(i18next);
  }

  if (i18next.language === locale && loadedLocales.has(locale)) {
    return i18next;
  }

  await clientI18nInitPromise;
  await loadLocaleIntoI18n(locale);
  await i18next.changeLanguage(locale);

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
  const [i18n, setI18n] = React.useState<typeof i18next | null>(
    didInitClientI18n ? i18next : null
  );

  React.useEffect(() => {
    let isCurrent = true;

    void ensureClientI18n(locale).then((instance) => {
      if (!isCurrent) {
        return;
      }

      document.documentElement.lang = locale;
      setI18n(instance);
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const setLocale = React.useCallback((nextLocale: AppLocale) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    window.localStorage.setItem(LOCALE_SOURCE_STORAGE_KEY, MANUAL_LOCALE_SOURCE);
    document.documentElement.lang = nextLocale;

    void ensureClientI18n(nextLocale).then(() => {
      setLocaleState(nextLocale);
      syncManualUserLocale(nextLocale);
    });
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: ((key, options) => (i18n ? i18n.t(key, options) : key)) as TranslateFn,
      tArray: (key) => {
        const value = i18n?.t(key, {
          returnObjects: true
        });

        return Array.isArray(value) ? value.map(String) : [];
      }
    }),
    [i18n, locale, setLocale]
  );

  if (!i18n) {
    return (
      <div
        aria-busy="true"
        className="tma-page grid place-items-center bg-surface text-[var(--iz-fallback-primary)]"
        role="status"
      >
        <span className="iz-spinner block size-5 rounded-full border-2 border-current border-b-transparent opacity-80" />
      </div>
    );
  }

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
