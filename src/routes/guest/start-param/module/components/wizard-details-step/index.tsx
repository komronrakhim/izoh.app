import { Check } from "lucide-react";

import { Avatar } from "~/common/components";
import { cn } from "~/common/utils";
import type { GuestEntryChannelId } from "~/shared/guest-entry";

import type { CustomerWizardTranslate, StaffTarget, TopicOption } from "../../types";

type WizardDetailsStepProps = {
  activeChannelId?: GuestEntryChannelId;
  onSelectStaffTarget: (id: string) => void;
  onToggleTopic: (id: string) => void;
  selectedTopicIds: string[];
  showStaffTarget: boolean;
  showTopics: boolean;
  staffTargetId: string;
  staffTargets: StaffTarget[];
  t: CustomerWizardTranslate;
  topicOptions: TopicOption[];
};

export const WizardDetailsStep = ({
  activeChannelId,
  onSelectStaffTarget,
  onToggleTopic,
  selectedTopicIds,
  showStaffTarget,
  showTopics,
  staffTargetId,
  staffTargets,
  t,
  topicOptions
}: WizardDetailsStepProps) => (
  <div className="grid gap-5">
    {showTopics && activeChannelId ? (
      <section className="grid gap-3">
        {showStaffTarget ? (
          <h2 className="ios-footnote px-1 font-semibold text-muted">
            {t(`customer.wizard.topics.${activeChannelId}.title`)}
          </h2>
        ) : null}
        <div className="flex flex-wrap gap-2.5">
          {topicOptions.map((option) => {
            const isSelected = selectedTopicIds.includes(option.id);

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggleTopic(option.id)}
                className={cn(
                  "ios-touch-target inline-flex items-center gap-2 rounded-full px-3.5 py-2 ios-subhead font-semibold ring-1 ring-foreground/[0.06] transition-[background-color,color,opacity,transform] active:scale-[0.97]",
                  isSelected
                    ? "bg-[color:var(--wizard-accent)] text-white"
                    : "bg-surface-2 text-foreground active:bg-surface-3"
                )}
              >
                <span className="text-[17px] leading-none" aria-hidden="true">
                  {option.emoji}
                </span>
                {option.title}
              </button>
            );
          })}
        </div>
      </section>
    ) : null}

    {showStaffTarget ? (
      <section className="grid gap-3">
        {showTopics ? (
          <h2 className="ios-footnote px-1 font-semibold text-muted">
            {t("customer.staffTarget.title")}
          </h2>
        ) : null}
        <div className="grid grid-cols-2 gap-2.5">
          {staffTargets.map((target) => {
            const Icon = target.icon;
            const active = target.id === staffTargetId;

            return (
              <button
                key={target.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectStaffTarget(target.id)}
                className={cn(
                  "ios-touch-target relative grid min-h-[148px] content-start justify-items-center gap-2.5 rounded-[28px] bg-surface-2 p-3.5 text-center ring-1 ring-foreground/[0.06] transition-[background-color,box-shadow,ring-color,transform] active:scale-[0.985]",
                  active &&
                    "bg-[color-mix(in_srgb,var(--wizard-accent)_9%,var(--iz-surface-2))] shadow-[0_14px_30px_color-mix(in_srgb,var(--wizard-accent)_16%,transparent)] ring-2 ring-[color:var(--wizard-accent)] dark:shadow-none"
                )}
              >
                {active ? (
                  <span className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full bg-[color:var(--wizard-accent)] text-white shadow-[0_8px_18px_color-mix(in_srgb,var(--wizard-accent)_28%,transparent)]">
                    <Check size={13} strokeWidth={2.8} />
                  </span>
                ) : null}
                {target.avatarUrl ? (
                  <Avatar
                    alt={target.title}
                    className={cn(
                      "size-16 rounded-full ring-1 ring-foreground/[0.06]",
                      active && "ring-2 ring-[color:var(--wizard-accent)]"
                    )}
                    initialsClassName="ios-title-3"
                    name={target.title}
                    seed={target.id}
                    src={target.avatarUrl}
                  />
                ) : (
                  <span
                    className={cn(
                      "grid size-16 place-items-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]",
                      target.tone
                    )}
                  >
                    <Icon size={25} strokeWidth={2.35} />
                  </span>
                )}
                <span className="grid min-w-0 max-w-full gap-0.5">
                  <span className="ios-subhead max-w-[132px] truncate font-semibold text-foreground">
                    {target.title}
                  </span>
                  {target.subtitle ? (
                    <span className="ios-caption-1 max-w-[132px] truncate text-muted">
                      {target.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    ) : null}
  </div>
);
