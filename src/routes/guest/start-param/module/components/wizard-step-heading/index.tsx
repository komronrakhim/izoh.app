import { cn } from "~/common/utils";

type WizardStepHeadingProps = {
  align?: "center" | "start";
  subtitle: string;
  title: string;
};

export const WizardStepHeading = ({ align = "start", subtitle, title }: WizardStepHeadingProps) => (
  <div
    className={cn(
      "grid gap-2",
      align === "center" ? "justify-items-center text-center" : "justify-items-start text-left"
    )}
  >
    <h1 className="max-w-[360px] text-[32px] font-semibold leading-[37px] tracking-normal text-foreground">
      {title}
    </h1>
    <p className="ios-callout max-w-[340px] text-muted">{subtitle}</p>
  </div>
);
