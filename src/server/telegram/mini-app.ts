import { getOptionalEnv } from "~/server/config/env";

export const getTelegramMiniAppBaseUrl = () => {
  const botUsername = (getOptionalEnv("TELEGRAM_BOT_USERNAME") ?? "izohappbot").replace(/^@+/, "");

  return `https://t.me/${botUsername}/app`;
};

export const getTelegramMiniAppUrl = (startParam: string) => {
  const baseUrl = getTelegramMiniAppBaseUrl();

  return startParam ? `${baseUrl}?startapp=${encodeURIComponent(startParam)}` : baseUrl;
};
