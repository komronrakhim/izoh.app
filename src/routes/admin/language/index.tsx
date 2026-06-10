import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import * as React from "react";

import { List } from "~/common/ui";
import { APP_LOCALES, type AppLocale } from "~/shared/i18n";
import { useI18n } from "~/shared/i18n/react";
import { PageTransition } from "~/shared/router/page-transition";
import { useTmaBackButton } from "~/shared/tma";

const LocaleCheck = ({ selected }: { selected: boolean }) =>
  selected ? (
    <Check aria-hidden="true" size={20} strokeWidth={2.45} className="text-primary" />
  ) : null;

export const AdminLanguagePage = () => {
  const navigate = useNavigate();
  const { locale, setLocale, t } = useI18n();

  const backToAdmin = React.useCallback(() => {
    void navigate({
      to: "/admin"
    });
  }, [navigate]);

  useTmaBackButton(true, backToAdmin);

  const selectLocale = React.useCallback(
    (nextLocale: AppLocale) => {
      setLocale(nextLocale);
    },
    [setLocale]
  );

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell pt-5">
          <List
            title={t("admin.language.listTitle")}
            hint={t("admin.language.listHint")}
            items={APP_LOCALES.map((item) => ({
              addon: {
                after: <LocaleCheck selected={item === locale} />
              },
              onClick: () => selectLocale(item),
              title: t(`common.locales.${item}.label`)
            }))}
          />
        </div>
      </main>
    </PageTransition>
  );
};
