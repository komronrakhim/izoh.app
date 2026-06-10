import { cn } from "~/common/utils";

import { choiceAmbientEmojis } from "../../constants";
import type { CustomerWizardTranslate, WizardChoice, WizardChoiceId } from "../../types";

type WizardChoiceStepProps = {
  choices: WizardChoice[];
  onChoose: (choice: WizardChoice) => void;
  selectedChoiceId: WizardChoiceId | null;
  t: CustomerWizardTranslate;
};

export const WizardChoiceStep = ({
  choices,
  onChoose,
  selectedChoiceId,
  t
}: WizardChoiceStepProps) => (
  <div className="grid grid-cols-2 gap-3">
    {choices.map((choice) => {
      const isSelected = choice.id === selectedChoiceId;
      const ambientEmojis = choiceAmbientEmojis[choice.id];

      return (
        <button
          key={choice.id}
          type="button"
          onClick={() => onChoose(choice)}
          className={cn(
            "ios-touch-target group relative min-h-[156px] overflow-hidden rounded-[30px] bg-surface-2 p-3.5 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)] ring-1 ring-foreground/[0.06] transition-[background-color,box-shadow,opacity,transform] active:scale-[0.985] dark:shadow-none",
            isSelected &&
              "shadow-[0_12px_28px_rgba(15,23,42,0.08)] ring-2 ring-[color:var(--wizard-accent)] dark:shadow-none"
          )}
        >
          <span
            className="pointer-events-none absolute right-3 top-3 text-[18px] leading-none opacity-[0.18] transition-transform duration-200 group-active:scale-95"
            aria-hidden="true"
          >
            {ambientEmojis[0]}
          </span>
          <span
            className="pointer-events-none absolute bottom-5 right-5 rotate-[-10deg] text-[30px] leading-none opacity-[0.12] transition-transform duration-200 group-active:translate-y-0.5"
            aria-hidden="true"
          >
            {ambientEmojis[1]}
          </span>
          <span
            className="pointer-events-none absolute bottom-12 right-14 rotate-[12deg] text-[21px] leading-none opacity-[0.1] transition-transform duration-200 group-active:-translate-y-0.5"
            aria-hidden="true"
          >
            {ambientEmojis[2]}
          </span>
          <span
            className={cn(
              "relative z-10 mb-4 grid size-[52px] shrink-0 place-items-center rounded-[19px] text-[27px] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]",
              choice.tone
            )}
            aria-hidden="true"
          >
            {choice.emoji}
          </span>
          <span className="relative z-10 grid min-w-0 gap-1.5">
            <span className="ios-headline max-w-[132px] text-foreground">
              {t(`customer.wizard.choices.${choice.id}.title`)}
            </span>
            <span className="ios-caption-1 max-w-[142px] text-muted">
              {t(`customer.wizard.choices.${choice.id}.subtitle`)}
            </span>
          </span>
        </button>
      );
    })}
  </div>
);
