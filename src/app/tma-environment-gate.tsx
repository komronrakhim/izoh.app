import * as React from "react";
import type { CSSProperties } from "react";

import { LogoWordmark, PendingScreen } from "~/common/ui";
import { IZOH_TELEGRAM_URL } from "~/shared/brand";
import { useI18n } from "~/shared/i18n/react";
import { useTma } from "~/shared/tma";

const telegramIconPath = "/landing/icons/telegram.svg";

const TelegramIcon = ({ className = "size-[21px]" }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`inline-block shrink-0 bg-current ${className}`}
    style={
      {
        WebkitMask: `url(${telegramIconPath}) center / contain no-repeat`,
        mask: `url(${telegramIconPath}) center / contain no-repeat`
      } as CSSProperties
    }
  />
);

const TmaOnlyScreen = () => {
  const { t } = useI18n();

  React.useEffect(() => {
    const previousTitle = document.title;

    document.title = `${t("common.brand")} — ${t("common.tmaOnly.title")}`;

    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfaff] px-5 text-[#17111f] antialiased">
      <section className="relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col items-center justify-center py-12 text-center">
        <LogoWordmark
          ariaTitle={t("common.brand")}
          className="h-auto w-[86px] text-[#17111f] sm:w-[94px]"
        />

        <div className="mt-10 grid gap-4 sm:gap-[18px]">
          <h1 className="text-[34px] font-semibold leading-[1.08] tracking-normal text-[#17111f] sm:text-[38px]">
            {t("common.tmaOnly.title")}
          </h1>
          <p className="mx-auto max-w-[460px] text-[17px] leading-[1.48] text-[#62596f] sm:text-[18px]">
            {t("common.tmaOnly.subtitle")}
          </p>
        </div>

        <a
          className="mt-8 inline-flex min-h-12 w-full max-w-[320px] items-center justify-center gap-2 rounded-full bg-[#6817FF] px-6 text-[16px] font-semibold text-white transition hover:bg-[#5912df] active:scale-[0.99]"
          href={IZOH_TELEGRAM_URL}
        >
          <TelegramIcon />
          {t("common.tmaOnly.action")}
        </a>

        <p className="mt-4 max-w-[360px] text-[14px] leading-[1.45] text-[#8a8295]">
          {t("common.tmaOnly.hint")}
        </p>
      </section>
    </main>
  );
};

export const TmaEnvironmentGate = ({ children }: { children: React.ReactNode }) => {
  const tma = useTma();
  const isTelegramMiniApp = tma.isTelegram && Boolean(tma.initDataRaw);
  const isPublicLandingPath =
    typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === "";

  if (!tma.isReady) {
    return <PendingScreen />;
  }

  if (!isTelegramMiniApp && isPublicLandingPath) {
    return <>{children}</>;
  }

  if (!isTelegramMiniApp) {
    return <TmaOnlyScreen />;
  }

  return <>{children}</>;
};
