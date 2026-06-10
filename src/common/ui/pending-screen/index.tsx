import { cn } from "~/common/utils";
import { Spinner } from "../spinner";

type PendingScreenProps = {
  className?: string;
  label?: string;
};

export const PendingScreen = ({ className, label }: PendingScreenProps) => (
  <div
    className={cn(
      "tma-page grid place-items-center bg-surface text-foreground",
      className
    )}
  >
    <section className="grid justify-items-center gap-4 px-6 text-center" aria-busy="true">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2/86 text-primary shadow-[0_12px_34px_rgba(15,23,42,0.1)] ring-1 ring-foreground/[0.06] backdrop-blur-xl dark:shadow-[0_12px_34px_rgba(0,0,0,0.28)]">
        <Spinner size={22} />
      </span>
      {label ? <p className="ios-footnote max-w-[280px] text-muted">{label}</p> : null}
    </section>
  </div>
);
