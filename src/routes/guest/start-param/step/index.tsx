import { useParams } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

import { fetchApiJson } from "~/shared/api";
import { useI18n } from "~/shared/i18n/react";
import type { PublicReviewLink } from "~/shared/module-settings";
import { type ExternalReviewClickResponsePayload } from "~/shared/public-reviews";
import {
  openTmaLink,
  pickTmaContact,
  useTma,
  useTmaBackButton,
  useTmaMainButton
} from "~/shared/tma";

import {
  WizardContactStep,
  WizardDetailsStep,
  WizardDoneStep,
  WizardMessageStep,
  WizardProgress,
  WizardRatingStep,
  WizardStepHeading,
  WizardSummaryStep
} from "../module/components";
import { stepTransition } from "../module/constants";
import { useCustomerWizard } from "../module/context";
import type { WizardRouteStep } from "../module/types";

const wizardRouteSteps = ["rating", "details", "message", "contact", "summary", "done"] as const;

const isWizardRouteStep = (value: unknown): value is WizardRouteStep =>
  typeof value === "string" && wizardRouteSteps.includes(value as WizardRouteStep);

export const CustomerWizardStepPage = () => {
  const params = useParams({
    strict: false
  });
  const routeStep = isWizardRouteStep(params.wizardStep) ? params.wizardStep : null;
  const wizard = useCustomerWizard();
  const { t } = useI18n();
  const tma = useTma();
  const [isAddingContact, setIsAddingContact] = React.useState(false);
  const [isPublicReviewOpening, setIsPublicReviewOpening] = React.useState(false);
  const resolvedStep = routeStep ? wizard.resolveRouteStep(routeStep) : "choice";
  const step = routeStep && resolvedStep === routeStep ? routeStep : null;
  const mainButtonState = step ? wizard.getMainButtonState(step) : null;
  const canPraiseSpecificPersonOrTeam = React.useMemo(
    () =>
      wizard.activeChannel?.id === "review" &&
      wizard.staffTargets.some((target) => target.targetType !== "unknown"),
    [wizard.activeChannel?.id, wizard.staffTargets]
  );

  React.useEffect(() => {
    if (!routeStep || resolvedStep === "choice") {
      wizard.goToChoice({
        replace: true
      });
      return;
    }

    if (resolvedStep !== routeStep) {
      wizard.goToStep(resolvedStep, {
        replace: true
      });
    }
  }, [resolvedStep, routeStep, wizard]);

  useTmaBackButton(Boolean(step && wizard.canGoBack(step)), () => {
    if (step) {
      wizard.goBack(step);
    }
  });
  useTmaMainButton(mainButtonState, () => {
    if (step) {
      wizard.goNext(step);
    }
  });

  const handleAddContact = React.useCallback(async () => {
    setIsAddingContact(true);

    try {
      await pickTmaContact({
        copy: {
          getUsernameLabel: (username) =>
            t("common.contactQuickFill.useUsername", {
              username
            }),
          quickPickMessage: t("common.contactQuickFill.message"),
          quickPickTitle: t("common.contactQuickFill.title"),
          usePhone: t("common.contactQuickFill.usePhone")
        },
        haptics: tma.haptics,
        initDataRaw: tma.initDataRaw,
        onContact: wizard.onContactChange,
        username: tma.user?.username
      });
    } finally {
      setIsAddingContact(false);
    }
  }, [t, tma.haptics, tma.initDataRaw, tma.user?.username, wizard.onContactChange]);

  const handlePublicReviewLinkClick = React.useCallback(
    async (link: PublicReviewLink) => {
      if (!wizard.guestEntryConfig || !wizard.submittedSubmissionId || isPublicReviewOpening) {
        tma.haptics.notification("error");
        return;
      }

      setIsPublicReviewOpening(true);

      try {
        const payload = await fetchApiJson<ExternalReviewClickResponsePayload>(
          "/api/external-review-clicks",
          {
            body: JSON.stringify({
              guestEntryScanId: wizard.guestEntryConfig.scanId ?? undefined,
              linkId: link.id,
              organizationId: wizard.guestEntryConfig.organization.id,
              submissionId: wizard.submittedSubmissionId
            }),
            headers: {
              "Content-Type": "application/json"
            },
            method: "POST"
          }
        );

        tma.haptics.notification("success");
        openTmaLink(payload.url);
      } catch {
        tma.haptics.notification("error");
      } finally {
        setIsPublicReviewOpening(false);
      }
    },
    [isPublicReviewOpening, tma.haptics, wizard.guestEntryConfig, wizard.submittedSubmissionId]
  );

  if (!step) {
    return null;
  }

  const progressMeta = wizard.progressMetaForStep(step);

  return (
    <>
      {wizard.showProgress(step) ? (
        <WizardProgress current={progressMeta.current} total={progressMeta.total} />
      ) : null}

      <div className={step === "done" ? "flex flex-1 flex-col" : "flex flex-1 flex-col pt-4"}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={wizard.getStepContentKey(step)}
            className={step === "done" ? "flex flex-1 flex-col" : "grid content-start gap-5"}
            initial={stepTransition.initial}
            animate={stepTransition.animate}
            exit={stepTransition.exit}
            transition={stepTransition.transition}
          >
            {step === "done" ? (
              <WizardDoneStep
                isPublicReviewOpening={isPublicReviewOpening}
                onPublicReviewLinkClick={handlePublicReviewLinkClick}
                poweredByLabel={t("common.poweredBy")}
                publicReviewCloseLabel={t("common.actions.close")}
                publicReviewCtaLabel={t("customer.wizard.done.publicReview.cta")}
                publicReviewSheetTitle={t("customer.wizard.done.publicReview.title")}
                publicReviewLinks={wizard.submittedSubmissionId ? wizard.publicReviewLinks : []}
                title={wizard.getStepTitle(step)}
                subtitle={wizard.getStepSubtitle(step)}
              />
            ) : (
              <>
                <WizardStepHeading
                  align="start"
                  title={wizard.getStepTitle(step)}
                  subtitle={wizard.getStepSubtitle(step)}
                />

                {step === "rating" ? (
                  <WizardRatingStep
                    onRatingChange={wizard.onRatingChange}
                    rating={wizard.rating}
                    selectedRatingEmoji={wizard.selectedRatingEmoji}
                    selectedRatingLabel={wizard.selectedRatingLabel}
                    shouldAllowPersonOrTeamPraise={canPraiseSpecificPersonOrTeam}
                    t={t}
                  />
                ) : null}

                {step === "details" ? (
                  <WizardDetailsStep
                    activeChannelId={wizard.activeChannel?.id}
                    onSelectStaffTarget={wizard.onSelectStaffTarget}
                    onToggleTopic={wizard.onToggleTopic}
                    selectedTopicIds={wizard.selectedTopicIds}
                    showStaffTarget={wizard.showStaffTarget}
                    showTopics={wizard.showTopics}
                    staffTargetId={wizard.staffTargetId}
                    staffTargets={wizard.staffTargets}
                    t={t}
                    topicOptions={wizard.topicOptions}
                  />
                ) : null}

                {step === "message" ? (
                  <WizardMessageStep
                    bodyText={wizard.bodyText}
                    helperText={wizard.messageHelperText}
                    helperTone={wizard.messageHelperTone}
                    onBodyTextChange={wizard.onBodyTextChange}
                    onPhotoFiles={wizard.onPhotoFiles}
                    onRemovePhoto={wizard.onRemovePhoto}
                    photoInputRef={wizard.photoInputRef}
                    photoHint={wizard.photoHint}
                    photos={wizard.photos}
                    photosEnabled={wizard.photosEnabled}
                    placeholder={wizard.messagePlaceholder}
                    t={t}
                  />
                ) : null}

                {step === "contact" ? (
                  <WizardContactStep
                    addContactLabel={t("common.contactQuickFill.add")}
                    clearLabel={t("common.actions.clear")}
                    contact={wizard.contact}
                    contactRequired={wizard.contactRequired}
                    isAddingContact={isAddingContact}
                    onAddContact={handleAddContact}
                    onContactChange={wizard.onContactChange}
                    onSkip={() => wizard.goNext(step)}
                    placeholder={t("customer.wizard.contact.placeholder")}
                    showInvalid={
                      wizard.contactRequired && wizard.validationAttemptedStep === "contact"
                    }
                    skipLabel={t("customer.wizard.contact.skip")}
                  />
                ) : null}

                {step === "summary" ? (
                  <WizardSummaryStep
                    activeChannelId={wizard.activeChannel?.id}
                    bodyText={wizard.bodyText}
                    contact={wizard.contactEnabled ? wizard.contact : ""}
                    noTextLabel={t("customer.wizard.summary.noText")}
                    photoCount={wizard.photos.filter((photo) => photo.status === "ready").length}
                    selectedChoice={wizard.selectedChoice}
                    selectedRatingEmoji={wizard.selectedRatingEmoji}
                    selectedRatingLabel={wizard.selectedRatingLabel}
                    selectedStaffTarget={wizard.selectedStaffTarget}
                    selectedTopicOptions={wizard.selectedTopicOptions}
                    summaryHint={wizard.summaryHint}
                    t={t}
                  />
                ) : null}
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </>
  );
};
