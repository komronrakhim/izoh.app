"use client";

import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { type Transition } from "motion";
import { AnimatePresence, type HTMLMotionProps, motion } from "motion/react";
import { Spinner } from "~/common/ui";
import { cn } from "~/common/utils";
import { tmaHaptics } from "~/shared/tma";
import { buttonVariants } from "./variants";

type ButtonState = "idle" | "loading" | "success" | "failed";
type ButtonType = "button" | "submit" | "reset" | "destructive";

interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref" | "type">, VariantProps<typeof buttonVariants> {
  state?: ButtonState;
  type?: ButtonType;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      tone,
      size = "md",
      state = "idle",
      wide,
      type = "button",
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const htmlType = type === "destructive" ? "button" : type;
    const resolvedTone = type === "destructive" ? "destructive" : tone;
    const isDisabled = state === "loading" || Boolean(props.disabled);

    const iconSizeMap = {
      xs: 14,
      sm: 16,
      md: 18,
      lg: 20,
      xl: 22,
      "2xl": 24
    } as const;

    const iconSize = iconSizeMap[size ?? "md"];

    const transition: Transition = {
      type: "spring",
      stiffness: 420,
      damping: 28,
      mass: 0.6
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        tmaHaptics.impact("light");
      }

      onClick?.(event);
    };

    const iconVariants = {
      initial: { opacity: 0, y: -6, scale: 0.9 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: 6, scale: 0.9 }
    };

    const renderIcon = () => {
      switch (state) {
        case "loading":
          return (
            <motion.div
              key="loading"
              variants={iconVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
            >
              <Spinner size={iconSize} />
            </motion.div>
          );
        case "success":
          return (
            <motion.div
              key="success"
              variants={iconVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                width={iconSize}
                height={iconSize}
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                />
              </svg>
            </motion.div>
          );
        case "failed":
          return (
            <motion.div
              key="failed"
              variants={iconVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                width={iconSize}
                height={iconSize}
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"
                />
              </svg>
            </motion.div>
          );
        default:
          return null;
      }
    };

    return (
      <motion.button
        ref={ref}
        type={htmlType}
        className={cn(buttonVariants({ variant, tone: resolvedTone, size, wide }), className)}
        whileTap={isDisabled ? undefined : { scale: 0.995 }}
        transition={{ duration: 0.1 }}
        disabled={isDisabled}
        onClick={handleClick}
        {...props}
      >
        <span className="relative z-10 invisible flex h-full items-center justify-center gap-2">
          {children as React.ReactNode}
        </span>

        <span className="absolute inset-0 z-10 flex items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {state !== "idle" ? (
              renderIcon()
            ) : (
              <motion.span
                key="text"
                className="inline-flex h-full items-center justify-center gap-2 leading-none"
                variants={iconVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                {children}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </motion.button>
    );
  }
);

Button.displayName = "Button";
