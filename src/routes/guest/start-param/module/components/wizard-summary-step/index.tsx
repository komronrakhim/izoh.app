import type { ReactNode } from "react";

import { Avatar } from "~/common/components";
import { cn } from "~/common/utils";
import type { GuestEntryChannelId } from "~/shared/guest-entry";

import type { CustomerWizardTranslate, StaffTarget, TopicOption, WizardChoice } from "../../types";

type WizardSummaryStepProps = {
  activeChannelId?: GuestEntryChannelId;
  bodyText: string;
  contact: string;
  noTextLabel: string;
  photoCount: number;
  selectedChoice?: WizardChoice;
  selectedRatingEmoji: string;
  selectedRatingLabel: string;
  selectedStaffTarget?: StaffTarget;
  selectedTopicOptions: TopicOption[];
  summaryHint?: string;
  t: CustomerWizardTranslate;
};

export const WizardSummaryStep = ({
  activeChannelId,
  bodyText,
  contact,
  noTextLabel,
  photoCount,
  selectedChoice,
  selectedRatingEmoji,
  selectedRatingLabel,
  selectedStaffTarget,
  selectedTopicOptions,
  summaryHint,
  t
}: WizardSummaryStepProps) => {
  const trimmedBodyText = bodyText.trim();
  const trimmedContact = contact.trim();

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-[30px] bg-surface-2 p-4 ring-1 ring-foreground/[0.06]">
        {selectedChoice ? (
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-[17px] text-[24px]",
                selectedChoice.tone
              )}
              aria-hidden="true"
            >
              {selectedChoice.emoji}
            </span>
            <div className="grid min-w-0 gap-0.5">
              <p className="ios-caption-1 font-semibold text-muted">
                {t("customer.wizard.summary.kind")}
              </p>
              <p className="ios-headline truncate text-foreground">
                {t(`customer.wizard.choices.${selectedChoice.id}.title`)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-2.5">
          {activeChannelId === "review" ? (
            <SummaryRow label={t("customer.wizard.summary.rating")}>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-[18px] leading-none" aria-hidden="true">
                  {selectedRatingEmoji}
                </span>
                {selectedRatingLabel}
              </span>
            </SummaryRow>
          ) : null}

          {selectedStaffTarget ? (
            <SummaryRow label={t("customer.wizard.summary.staff")}>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {selectedStaffTarget.avatarUrl ? (
                  <Avatar
                    alt={selectedStaffTarget.title}
                    className="size-5 rounded-full"
                    initialsClassName="ios-caption-2"
                    name={selectedStaffTarget.title}
                    seed={selectedStaffTarget.id}
                    src={selectedStaffTarget.avatarUrl}
                  />
                ) : null}
                <span className="truncate">{selectedStaffTarget.title}</span>
              </span>
            </SummaryRow>
          ) : null}

          {photoCount > 0 ? (
            <SummaryRow label={t("customer.wizard.summary.photos")}>
              {t("customer.wizard.summary.photosValue", {
                value: photoCount
              })}
            </SummaryRow>
          ) : null}

          {trimmedContact ? (
            <SummaryRow label={t("customer.wizard.summary.contact")}>
              <span className="truncate">{trimmedContact}</span>
            </SummaryRow>
          ) : null}
        </div>

        {selectedTopicOptions.length > 0 ? (
          <div className="grid gap-2 border-t border-foreground/[0.07] pt-3">
            <p className="ios-caption-1 font-semibold text-muted">
              {t("customer.wizard.summary.topics")}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedTopicOptions.map((topic) => (
                <span
                  key={topic.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 ios-footnote font-semibold text-foreground ring-1 ring-foreground/[0.05]"
                >
                  <span className="text-[15px] leading-none" aria-hidden="true">
                    {topic.emoji}
                  </span>
                  {topic.title}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-2 rounded-[26px] bg-surface-2 p-4 ring-1 ring-foreground/[0.06]">
        <p className="ios-caption-1 font-semibold text-muted">
          {t("customer.wizard.summary.comment")}
        </p>
        {trimmedBodyText ? (
          <p className="ios-body line-clamp-7 whitespace-pre-wrap text-foreground">
            {trimmedBodyText}
          </p>
        ) : (
          <p className="ios-footnote text-muted">{noTextLabel}</p>
        )}
      </section>

      {summaryHint ? <p className="px-1 ios-caption-1 text-muted">{summaryHint}</p> : null}
    </div>
  );
};

const SummaryRow = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="flex min-w-0 items-center justify-between gap-3">
    <span className="ios-footnote font-medium text-muted">{label}</span>
    <span className="min-w-0 text-right ios-footnote font-semibold text-foreground">
      {children}
    </span>
  </div>
);
