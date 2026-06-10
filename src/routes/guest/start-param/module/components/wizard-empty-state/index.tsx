type WizardEmptyStateProps = {
  subtitle: string;
  title: string;
};

export const WizardEmptyState = ({ subtitle, title }: WizardEmptyStateProps) => (
  <section className="grid flex-1 content-center gap-2 rounded-[28px] bg-surface-2 p-5 text-center ring-1 ring-foreground/[0.06]">
    <h2 className="ios-title-3 font-semibold text-foreground">{title}</h2>
    <p className="ios-footnote text-muted">{subtitle}</p>
  </section>
);
