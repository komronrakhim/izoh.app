import { motion } from "framer-motion";

type WizardProgressProps = {
  current: number;
  total: number;
};

export const WizardProgress = ({ current, total }: WizardProgressProps) => {
  if (total <= 1) {
    return null;
  }

  const normalizedCurrent = Math.min(Math.max(current, 1), total);
  const progress = normalizedCurrent / total;

  return (
    <div
      className="px-1"
      aria-label={`Step ${current} of ${total}`}
      role="progressbar"
      aria-valuemax={total}
      aria-valuemin={1}
      aria-valuenow={normalizedCurrent}
    >
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2/72 ring-1 ring-foreground/[0.04]">
        <motion.div
          className="h-full rounded-full"
          animate={{
            scaleX: progress
          }}
          initial={false}
          transition={{
            duration: 0.32,
            ease: [0.16, 1, 0.3, 1],
            type: "tween"
          }}
          style={{
            backgroundColor: "var(--wizard-accent)",
            boxShadow: "0 0 18px color-mix(in srgb, var(--wizard-accent) 34%, transparent)",
            transformOrigin: "0 50%"
          }}
        />
      </div>
    </div>
  );
};
