import { getTmaLaunchContext } from "~/shared/tma";

const telegramAnalyticsAppName = "izoh";

let initPromise: Promise<void> | null = null;

export const initTelegramAnalytics = () => {
  if (typeof window === "undefined" || initPromise) {
    return initPromise;
  }

  const token = import.meta.env.VITE_TG_ANALYTICS_TOKEN?.trim();

  if (!token) {
    return null;
  }

  const launchContext = getTmaLaunchContext();

  if (!launchContext.isTelegram || !launchContext.initDataRaw) {
    return null;
  }

  initPromise = import("@telegram-apps/analytics")
    .then(({ default: TelegramAnalytics }) =>
      TelegramAnalytics.init({
        appName: telegramAnalyticsAppName,
        token
      })
    )
    .catch((error: unknown) => {
      initPromise = null;

      if (import.meta.env.DEV) {
        console.warn("Telegram Analytics initialization failed.", error);
      }
    });

  return initPromise;
};
