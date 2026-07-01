import { type AppLocale } from "./config";

const I18N_NAMESPACES = [
  "admin",
  "common",
  "customer",
  "landing",
  "pdf",
  "qr",
  "telegram"
] as const;

type I18nNamespace = (typeof I18N_NAMESPACES)[number];
type LocaleMessages = Record<I18nNamespace, unknown>;
type LocaleModule = {
  default: unknown;
};

const localeMessageLoaders = import.meta.glob<LocaleModule>("./locales/*/*.json");
const localeMessagesCache = new Map<AppLocale, Promise<LocaleMessages>>();

const getLocaleMessagePath = (locale: AppLocale, namespace: I18nNamespace) =>
  `./locales/${locale}/${namespace}.json`;

const loadNamespace = async (locale: AppLocale, namespace: I18nNamespace) => {
  const loader = localeMessageLoaders[getLocaleMessagePath(locale, namespace)];

  if (!loader) {
    throw new Error(`Missing i18n namespace: ${locale}/${namespace}`);
  }

  const module = await loader();

  return [namespace, module.default] as const;
};

export const loadClientI18nMessages = (locale: AppLocale) => {
  const cached = localeMessagesCache.get(locale);

  if (cached) {
    return cached;
  }

  const promise = Promise.all(
    I18N_NAMESPACES.map((namespace) => loadNamespace(locale, namespace))
  ).then((entries) => Object.fromEntries(entries) as LocaleMessages);

  localeMessagesCache.set(locale, promise);

  return promise;
};
