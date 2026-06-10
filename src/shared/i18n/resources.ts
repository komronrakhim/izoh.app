import type { Resource } from "i18next";

import ruAdmin from "./locales/ru/admin.json";
import ruCommon from "./locales/ru/common.json";
import ruCustomer from "./locales/ru/customer.json";
import ruPdf from "./locales/ru/pdf.json";
import ruQr from "./locales/ru/qr.json";
import ruTelegram from "./locales/ru/telegram.json";
import uzAdmin from "./locales/uz/admin.json";
import uzCommon from "./locales/uz/common.json";
import uzCustomer from "./locales/uz/customer.json";
import uzPdf from "./locales/uz/pdf.json";
import uzQr from "./locales/uz/qr.json";
import uzTelegram from "./locales/uz/telegram.json";

export const i18nMessages = {
  ru: {
    admin: ruAdmin,
    common: ruCommon,
    customer: ruCustomer,
    pdf: ruPdf,
    qr: ruQr,
    telegram: ruTelegram
  },
  uz: {
    admin: uzAdmin,
    common: uzCommon,
    customer: uzCustomer,
    pdf: uzPdf,
    qr: uzQr,
    telegram: uzTelegram
  }
} as const;

export type IzohMessages = typeof i18nMessages;

export type TranslationKey = string;

export const i18nResources = {
  ru: {
    translation: i18nMessages.ru
  },
  uz: {
    translation: i18nMessages.uz
  }
} satisfies Resource;
