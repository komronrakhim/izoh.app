import { cn } from "~/common/utils";
import { Spinner } from "../spinner";

type PendingScreenProps = {
  className?: string;
  label?: string;
};

export const PendingScreen = ({ className, label }: PendingScreenProps) => (
  <div
    className={cn(
      "tma-page grid place-items-center bg-surface text-[var(--iz-fallback-primary)]",
      className
    )}
    aria-busy="true"
    aria-label={label}
    role="status"
  >
    <Spinner size={19} />
  </div>
);
