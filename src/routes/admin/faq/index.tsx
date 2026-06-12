import { useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { List } from "~/common/ui";
import { PageTransition } from "~/shared/router/page-transition";
import { IZOH_SUPPORT_TELEGRAM_URL } from "~/shared/brand";
import { useI18n } from "~/shared/i18n/react";
import { openTmaTelegramLink, useTmaBackButton } from "~/shared/tma";

const faqItems = ["guestEntry", "setup", "staff", "notifications"] as const;

export const AdminFaqPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  const backToAdmin = React.useCallback(() => {
    void navigate({
      to: "/admin"
    });
  }, [navigate]);

  const openSupport = React.useCallback(() => {
    openTmaTelegramLink(IZOH_SUPPORT_TELEGRAM_URL);
  }, []);

  useTmaBackButton(true, backToAdmin);

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <section className="grid gap-2 px-4">
            <h1 className="ios-title-1 font-semibold tracking-normal text-foreground">
              {t("admin.faq.title")}
            </h1>
            <p className="ios-footnote max-w-[460px] text-muted">{t("admin.faq.subtitle")}</p>
          </section>

          <section className="grid gap-5 px-4">
            {faqItems.map((item) => (
              <article key={item} className="grid gap-1.5">
                <h2 className="ios-body font-semibold text-foreground">
                  {t(`admin.faq.items.${item}.title`)}
                </h2>
                <p className="ios-footnote max-w-[500px] leading-relaxed text-muted">
                  {t(`admin.faq.items.${item}.body`)}
                </p>
              </article>
            ))}
          </section>

          <List
            items={[
              {
                onClick: openSupport,
                subtitle: t("admin.faq.support.body"),
                title: t("admin.faq.support.title")
              }
            ]}
          />
        </div>
      </main>
    </PageTransition>
  );
};
