import { Check } from "lucide-react";
import { motion } from "framer-motion";

import { doneTransition } from "../../constants";
import { WizardPoweredBy } from "../wizard-powered-by";

type WizardDoneStepProps = {
  poweredByLabel: string;
  subtitle: string;
  title: string;
};

export const WizardDoneStep = ({ poweredByLabel, subtitle, title }: WizardDoneStepProps) => (
  <>
    <section className="grid flex-1 place-items-center text-center">
      <div className="grid justify-items-center gap-5">
        <motion.span
          className="grid size-20 place-items-center rounded-full bg-success text-white shadow-[0_18px_44px_rgba(52,199,89,0.22)]"
          initial={{ opacity: 0, scale: 0.72 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={doneTransition.icon}
        >
          <Check size={32} strokeWidth={2.7} />
        </motion.span>
        <motion.div
          className="grid max-w-[330px] gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={doneTransition.text}
        >
          <h1 className="ios-large-title font-semibold text-foreground">{title}</h1>
          <p className="ios-body text-muted">{subtitle}</p>
        </motion.div>
      </div>
    </section>

    <WizardPoweredBy label={poweredByLabel} />
  </>
);
