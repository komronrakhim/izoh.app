import { LogoWordmark } from "~/common/ui";
import { IZOH_TELEGRAM_URL } from "~/shared/brand";
import { openTmaTelegramLink } from "~/shared/tma";

type WizardPoweredByProps = {
  label: string;
};

export const WizardPoweredBy = ({ label }: WizardPoweredByProps) => (
  <footer className="mt-auto pb-1 pt-5 text-center">
    <a
      aria-label={label}
      className="inline-flex min-h-9 items-center rounded-full px-3 py-1.5 text-black/45 transition-[color,opacity,background-color] hover:bg-foreground/[0.045] hover:text-foreground active:opacity-70 dark:text-white/45"
      href={IZOH_TELEGRAM_URL}
      rel="noreferrer"
      target="_blank"
      onClick={(event) => {
        event.preventDefault();
        openTmaTelegramLink(IZOH_TELEGRAM_URL);
      }}
    >
      <LogoWordmark className="w-[42px]" />
    </a>
  </footer>
);
