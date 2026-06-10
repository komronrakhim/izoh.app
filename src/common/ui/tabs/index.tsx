"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "~/common/utils";
import { AnimatePresence } from "motion/react";
import { tmaHaptics } from "~/shared/tma";

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string }[];
  className?: string;
  compact?: boolean;
};

export const Tabs = ({ value, onValueChange, items, className, compact = false }: TabsProps) => {
  const layoutId = React.useId();

  const selectValue = (nextValue: string) => {
    if (nextValue !== value) {
      tmaHaptics.selection();
    }

    onValueChange(nextValue);
  };

  return (
    <div
      className={cn(
        "scrollbar-hide relative flex w-full overflow-x-auto rounded-[18px] bg-foreground/[0.055] p-1 dark:bg-white/[0.07]",
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => selectValue(item.value)}
            className={cn(
              "relative flex-1 whitespace-nowrap rounded-xl font-medium transition-colors",
              compact ? "min-h-11 px-3 py-1.5 ios-caption-1" : "min-h-11 px-4 py-2 ios-subhead",
              isActive ? "text-foreground" : "text-muted hover:text-foreground"
            )}
          >
            <AnimatePresence mode="wait">
              {isActive && (
                <motion.span
                  layoutId={`tabs-active-${layoutId}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{
                    type: "spring",
                    stiffness: 550,
                    damping: 32,
                    mass: 0.4
                  }}
                  className="pointer-events-none absolute inset-0 rounded-[14px] bg-surface-2 shadow-[0_1px_4px_rgba(15,23,42,0.08)] dark:bg-surface-3 dark:shadow-[0_1px_4px_rgba(0,0,0,0.28)]"
                />
              )}
            </AnimatePresence>
            <span className="relative z-10 whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
