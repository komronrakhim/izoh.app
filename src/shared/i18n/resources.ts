import type { Resource } from "i18next";

import azAdmin from "./locales/az/admin.json";
import azCommon from "./locales/az/common.json";
import azCustomer from "./locales/az/customer.json";
import azPdf from "./locales/az/pdf.json";
import azQr from "./locales/az/qr.json";
import azTelegram from "./locales/az/telegram.json";
import enAdmin from "./locales/en/admin.json";
import enCommon from "./locales/en/common.json";
import enCustomer from "./locales/en/customer.json";
import enPdf from "./locales/en/pdf.json";
import enQr from "./locales/en/qr.json";
import enTelegram from "./locales/en/telegram.json";
import kkAdmin from "./locales/kk/admin.json";
import kkCommon from "./locales/kk/common.json";
import kkCustomer from "./locales/kk/customer.json";
import kkPdf from "./locales/kk/pdf.json";
import kkQr from "./locales/kk/qr.json";
import kkTelegram from "./locales/kk/telegram.json";
import kyAdmin from "./locales/ky/admin.json";
import kyCommon from "./locales/ky/common.json";
import kyCustomer from "./locales/ky/customer.json";
import kyPdf from "./locales/ky/pdf.json";
import kyQr from "./locales/ky/qr.json";
import kyTelegram from "./locales/ky/telegram.json";
import ruAdmin from "./locales/ru/admin.json";
import ruCommon from "./locales/ru/common.json";
import ruCustomer from "./locales/ru/customer.json";
import ruPdf from "./locales/ru/pdf.json";
import ruQr from "./locales/ru/qr.json";
import ruTelegram from "./locales/ru/telegram.json";
import tgAdmin from "./locales/tg/admin.json";
import tgCommon from "./locales/tg/common.json";
import tgCustomer from "./locales/tg/customer.json";
import tgPdf from "./locales/tg/pdf.json";
import tgQr from "./locales/tg/qr.json";
import tgTelegram from "./locales/tg/telegram.json";
import trAdmin from "./locales/tr/admin.json";
import trCommon from "./locales/tr/common.json";
import trCustomer from "./locales/tr/customer.json";
import trPdf from "./locales/tr/pdf.json";
import trQr from "./locales/tr/qr.json";
import trTelegram from "./locales/tr/telegram.json";
import ukAdmin from "./locales/uk/admin.json";
import ukCommon from "./locales/uk/common.json";
import ukCustomer from "./locales/uk/customer.json";
import ukPdf from "./locales/uk/pdf.json";
import ukQr from "./locales/uk/qr.json";
import ukTelegram from "./locales/uk/telegram.json";
import uzAdmin from "./locales/uz/admin.json";
import uzCommon from "./locales/uz/common.json";
import uzCustomer from "./locales/uz/customer.json";
import uzPdf from "./locales/uz/pdf.json";
import uzQr from "./locales/uz/qr.json";
import uzTelegram from "./locales/uz/telegram.json";

const createMessages = ({
  admin,
  common,
  customer,
  pdf,
  qr,
  telegram
}: {
  admin: typeof ruAdmin;
  common: typeof ruCommon;
  customer: typeof ruCustomer;
  pdf: typeof ruPdf;
  qr: typeof ruQr;
  telegram: typeof ruTelegram;
}) => ({
  admin,
  common,
  customer,
  pdf,
  qr,
  telegram
});

export const i18nMessages = {
  az: createMessages({
    admin: azAdmin,
    common: azCommon,
    customer: azCustomer,
    pdf: azPdf,
    qr: azQr,
    telegram: azTelegram
  }),
  en: createMessages({
    admin: enAdmin,
    common: enCommon,
    customer: enCustomer,
    pdf: enPdf,
    qr: enQr,
    telegram: enTelegram
  }),
  kk: createMessages({
    admin: kkAdmin,
    common: kkCommon,
    customer: kkCustomer,
    pdf: kkPdf,
    qr: kkQr,
    telegram: kkTelegram
  }),
  ky: createMessages({
    admin: kyAdmin,
    common: kyCommon,
    customer: kyCustomer,
    pdf: kyPdf,
    qr: kyQr,
    telegram: kyTelegram
  }),
  ru: createMessages({
    admin: ruAdmin,
    common: ruCommon,
    customer: ruCustomer,
    pdf: ruPdf,
    qr: ruQr,
    telegram: ruTelegram
  }),
  tg: createMessages({
    admin: tgAdmin,
    common: tgCommon,
    customer: tgCustomer,
    pdf: tgPdf,
    qr: tgQr,
    telegram: tgTelegram
  }),
  tr: createMessages({
    admin: trAdmin,
    common: trCommon,
    customer: trCustomer,
    pdf: trPdf,
    qr: trQr,
    telegram: trTelegram
  }),
  uk: createMessages({
    admin: ukAdmin,
    common: ukCommon,
    customer: ukCustomer,
    pdf: ukPdf,
    qr: ukQr,
    telegram: ukTelegram
  }),
  uz: createMessages({
    admin: uzAdmin,
    common: uzCommon,
    customer: uzCustomer,
    pdf: uzPdf,
    qr: uzQr,
    telegram: uzTelegram
  })
} as const;

export type IzohMessages = typeof i18nMessages;

export type TranslationKey = string;

export const i18nResources = {
  az: {
    translation: i18nMessages.az
  },
  en: {
    translation: i18nMessages.en
  },
  kk: {
    translation: i18nMessages.kk
  },
  ky: {
    translation: i18nMessages.ky
  },
  ru: {
    translation: i18nMessages.ru
  },
  tg: {
    translation: i18nMessages.tg
  },
  tr: {
    translation: i18nMessages.tr
  },
  uk: {
    translation: i18nMessages.uk
  },
  uz: {
    translation: i18nMessages.uz
  }
} satisfies Resource;
