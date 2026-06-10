import { Outlet } from "@tanstack/react-router";
import * as React from "react";

import { PendingScreen } from "~/common/ui";
import { useI18n } from "~/shared/i18n/react";
import { PageTransition } from "~/shared/router/page-transition";
import { hideTmaMainButtonNow } from "~/shared/tma";

import { WizardEmptyState, WizardShell } from "./module/components";
import { CustomerWizardProvider, useCustomerWizard } from "./module/context";

export const CustomerWizardRoute = () => (
  <CustomerWizardProvider>
    <CustomerWizardFrame />
  </CustomerWizardProvider>
);

const CustomerWizardFrame = () => {
  const { t } = useI18n();
  const wizard = useCustomerWizard();

  React.useLayoutEffect(() => {
    if (wizard.isLoading || wizard.isError || !wizard.guestEntryConfig) {
      hideTmaMainButtonNow();
    }
  }, [wizard.guestEntryConfig, wizard.isError, wizard.isLoading]);

  if (wizard.isLoading && !wizard.guestEntryConfig) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  if (wizard.isError && !wizard.guestEntryConfig) {
    return (
      <PageTransition>
        <WizardShell style={wizard.wizardStyle}>
          <WizardEmptyState
            title={t("customer.errorTitle")}
            subtitle={t("customer.errorSubtitle")}
          />
        </WizardShell>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <WizardShell style={wizard.wizardStyle}>
        <Outlet />
      </WizardShell>
    </PageTransition>
  );
};
