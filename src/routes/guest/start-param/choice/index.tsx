import { motion } from "framer-motion";
import * as React from "react";

import { hideTmaMainButtonNow, useTmaBackButton, useTmaMainButton } from "~/shared/tma";
import { useI18n } from "~/shared/i18n/react";

import {
  WizardChoiceStep,
  WizardEmptyState,
  WizardHeader,
  WizardPoweredBy,
  WizardStepHeading
} from "../module/components";
import { stepTransition } from "../module/constants";
import { useCustomerWizard } from "../module/context";
import { MenuUtilityBanner } from "../menu/menu-utility-banner";

export const CustomerWizardChoicePage = () => {
  const wizard = useCustomerWizard();
  const { t } = useI18n();

  React.useLayoutEffect(() => {
    wizard.resetToChoice();
    hideTmaMainButtonNow();
  }, [wizard.resetToChoice]);

  useTmaBackButton(false, () => undefined);
  useTmaMainButton(null, () => undefined);

  const menuAvailable = Boolean(wizard.guestEntryConfig?.menu?.available);
  const hasFeedbackChoices = wizard.choices.length > 0;

  if (!wizard.guestEntryConfig || (!hasFeedbackChoices && !menuAvailable)) {
    return (
      <WizardEmptyState title={t("customer.emptyTitle")} subtitle={t("customer.emptySubtitle")} />
    );
  }

  return (
    <>
      {wizard.organizationName ? (
        <WizardHeader
          avatarSeed={wizard.guestEntryConfig.organization.id}
          logoUrl={wizard.guestEntryConfig.organization.logoUrl ?? undefined}
          organizationName={wizard.organizationName}
          qrContext={
            wizard.guestEntryConfig.qrContext
              ? t("customer.qrContext", {
                  context: wizard.guestEntryConfig.qrContext
                })
              : undefined
          }
        />
      ) : null}

      {menuAvailable ? (
        <div className="pb-5 pt-1">
          <MenuUtilityBanner
            href={`/guest/${encodeURIComponent(wizard.guestEntryConfig.startParam)}/menu`}
            subtitle={t("customer.menu.banner.subtitle")}
            title={t("customer.menu.banner.title")}
          />
        </div>
      ) : null}

      <div className={`flex flex-1 flex-col${menuAvailable ? "" : " pt-1"}`}>
        {hasFeedbackChoices ? (
          <motion.section
            key={wizard.getStepContentKey("choice")}
            className="grid content-start gap-5"
            initial={stepTransition.initial}
            animate={stepTransition.animate}
            exit={stepTransition.exit}
            transition={stepTransition.transition}
          >
            <WizardStepHeading
              align="center"
              title={wizard.getStepTitle("choice")}
              subtitle={wizard.getStepSubtitle("choice")}
            />

            <WizardChoiceStep
              choices={wizard.choices}
              onChoose={wizard.choose}
              selectedChoiceId={wizard.selectedChoiceId}
              t={t}
            />
          </motion.section>
        ) : null}
      </div>

      <WizardPoweredBy label={t("common.poweredBy")} />
    </>
  );
};
