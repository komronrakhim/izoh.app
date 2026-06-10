"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "~/common/utils";

type Props = {
  threshold?: number;
  className?: string;
};

export const ScrollToTopButton = ({ threshold = 360, className }: Props) => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const update = () => {
      setVisible(window.scrollY > threshold);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [threshold]);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          aria-label="Scroll to top"
          onClick={handleClick}
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 32,
            mass: 0.6
          }}
          className={cn(
            "iz-glass iz-liquid-floating fixed bottom-5 right-5 z-40 inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors",
            className
          )}
        >
          <ArrowUp size={18} />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
};
