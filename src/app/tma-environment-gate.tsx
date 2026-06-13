import * as React from "react";

import { Button, Logo, LogoWordmark, PendingScreen } from "~/common/ui";
import { cn } from "~/common/utils";
import { IZOH_TELEGRAM_URL } from "~/shared/brand";
import { useI18n } from "~/shared/i18n/react";
import { useTma } from "~/shared/tma";

const TmaOnlyScreen = () => {
  const { t } = useI18n();

  return (
    <main className="tma-page grid bg-surface px-5 text-foreground">
      <section className="mx-auto flex w-full max-w-[360px] flex-col items-center justify-center gap-7 py-12 text-center">
        <div className="grid justify-items-center gap-4">
          <Logo className="size-16 text-foreground" />
          <LogoWordmark ariaTitle={t("common.brand")} className="h-auto w-24 text-foreground" />
        </div>

        <div className="grid gap-2.5">
          <h1 className="ios-title-2 font-semibold tracking-normal">
            {t("common.tmaOnly.title")}
          </h1>
          <p className="ios-body leading-relaxed text-muted">{t("common.tmaOnly.subtitle")}</p>
        </div>

        <Button
          className={cn(
            "min-h-12 w-full rounded-full px-5 ios-headline font-semibold",
            "shadow-[0_14px_34px_rgba(0,122,255,0.22)]"
          )}
          onClick={() => {
            window.location.href = IZOH_TELEGRAM_URL;
          }}
        >
          {t("common.tmaOnly.action")}
        </Button>
      </section>
    </main>
  );
};

export const TmaEnvironmentGate = ({ children }: { children: React.ReactNode }) => {
  const tma = useTma();
  const isTelegramMiniApp = tma.isTelegram && Boolean(tma.initDataRaw);

  if (!tma.isReady) {
    return <PendingScreen />;
  }

  if (!isTelegramMiniApp) {
    return <TmaOnlyScreen />;
  }

  return <>{children}</>;
};
