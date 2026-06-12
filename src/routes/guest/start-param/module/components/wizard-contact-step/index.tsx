import { Plus, X } from "lucide-react";

import { cn } from "~/common/utils";

type WizardContactStepProps = {
  addContactLabel: string;
  clearLabel: string;
  contact: string;
  contactRequired: boolean;
  isAddingContact?: boolean;
  onAddContact: () => void;
  onContactChange: (value: string) => void;
  onSkip: () => void;
  placeholder: string;
  showInvalid: boolean;
  skipLabel: string;
};

export const WizardContactStep = ({
  addContactLabel,
  clearLabel,
  contact,
  contactRequired,
  isAddingContact,
  onAddContact,
  onContactChange,
  onSkip,
  placeholder,
  showInvalid,
  skipLabel
}: WizardContactStepProps) => (
  <div className="grid gap-3">
    <div className="relative">
      <input
        className={cn(
          "ios-touch-target w-full rounded-[24px] bg-surface-2 px-4 pr-12 ios-body text-foreground caret-[color:var(--wizard-accent)] outline-none ring-1 ring-foreground/[0.06] transition-[box-shadow,background-color] placeholder:text-placeholder focus:ring-2 focus:ring-[color:var(--wizard-accent)]",
          showInvalid && !contact.trim() && "ring-danger/38"
        )}
        placeholder={placeholder}
        value={contact}
        onChange={(event) => onContactChange(event.target.value)}
      />
      {contact ? (
        <button
          aria-label={clearLabel}
          className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-foreground/14 text-surface-2 transition-[background-color,transform] active:scale-95 dark:bg-white/22 dark:text-[#1c1c1e]"
          type="button"
          onClick={() => onContactChange("")}
        >
          <X size={14} strokeWidth={3} />
        </button>
      ) : (
        <button
          aria-label={addContactLabel}
          className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-[color:var(--wizard-accent)] text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-[opacity,transform] active:scale-95 disabled:pointer-events-none disabled:opacity-58 [&_svg]:absolute [&_svg]:left-1/2 [&_svg]:top-1/2 [&_svg]:block [&_svg]:-translate-x-1/2 [&_svg]:-translate-y-1/2"
          disabled={isAddingContact}
          type="button"
          onClick={onAddContact}
        >
          <Plus size={15} strokeWidth={3} />
        </button>
      )}
    </div>
    {!contactRequired ? (
      <button
        type="button"
        className="ios-touch-target justify-self-center rounded-full px-4 ios-subhead font-semibold text-muted transition-colors active:text-foreground"
        onClick={onSkip}
      >
        {skipLabel}
      </button>
    ) : null}
  </div>
);
