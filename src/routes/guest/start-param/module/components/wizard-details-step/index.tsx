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
                  "ios-touch-target grid h-[132px] justify-items-center gap-2 rounded-[26px] bg-surface-2 p-3 text-center ring-1 ring-foreground/[0.06] transition-[box-shadow,transform] active:scale-[0.985]",
                  active && "ring-2 ring-[color:var(--wizard-accent)]"
                )}
              >
                {target.avatarUrl ? (
                  <Avatar
                    alt={target.title}
                    className="size-[54px] rounded-[20px]"
                    initialsClassName="ios-subhead"
                    name={target.title}
                    seed={target.id}
                    src={target.avatarUrl}
                  />
                ) : (
                  <span
                    className={cn(
                      "grid size-[54px] place-items-center rounded-[20px]",
                      target.tone
                    )}
                  >
                    <Icon size={22} strokeWidth={2.35} />
                  </span>
                )}
                <span className="grid min-w-0 gap-0.5">
                  <span className="ios-subhead max-w-[128px] truncate font-semibold text-foreground">
                    {target.title}
                  </span>
                  <span className="ios-caption-1 max-w-[128px] truncate text-muted">
                    {target.subtitle}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    ) : null}
  </div>
);
