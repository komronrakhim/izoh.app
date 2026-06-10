type WizardPoweredByProps = {
  label: string;
};

export const WizardPoweredBy = ({ label }: WizardPoweredByProps) => (
  <footer className="mt-auto pb-1 pt-5 text-center">
    <span className="inline-flex items-center rounded-full bg-surface-2 px-3 py-1.5 ios-caption-2 font-semibold text-muted ring-1 ring-foreground/[0.05]">
      {label}
    </span>
  </footer>
);
