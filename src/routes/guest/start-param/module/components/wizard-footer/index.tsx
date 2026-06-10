import { Send } from "lucide-react";

import { Spinner } from "~/common/ui";

type WizardFooterProps = {
  disabled: boolean;
  isSubmitting: boolean;
  label: string;
  onClick: () => void;
  showSendIcon: boolean;
};

export const WizardFooter = ({
  disabled,
  isSubmitting,
  label,
  onClick,
  showSendIcon
}: WizardFooterProps) => (
  <footer className="tma-fallback-action sticky bottom-0 z-20 pt-3">
    <button
      className="ios-touch-target flex h-14 w-full items-center justify-center gap-2 rounded-full px-5 ios-headline font-semibold text-white shadow-[0_16px_38px_rgba(0,122,255,0.24)] transition-[filter,opacity,transform] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      style={{
        backgroundColor: "var(--wizard-accent)"
      }}
      type="button"
      onClick={onClick}
    >
      {isSubmitting ? (
        <Spinner size={18} />
      ) : showSendIcon ? (
        <Send size={18} strokeWidth={2.45} />
      ) : null}
      {label}
    </button>
  </footer>
);
