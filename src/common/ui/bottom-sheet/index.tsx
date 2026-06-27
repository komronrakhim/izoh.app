"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "~/common/utils";
import { tmaHaptics } from "~/shared/tma";

type BottomSheetProps = {
  children: React.ReactNode;
  className?: string;
  closeLabel: string;
  contentClassName?: string;
  description?: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  overlayClassName?: string;
  showClose?: boolean;
  title?: React.ReactNode;
};

const sheetTransition: Transition = {
  damping: 34,
  mass: 0.72,
  stiffness: 520,
  type: "spring"
};

export const BottomSheet = ({
  children,
  className,
  closeLabel,
  contentClassName,
  description,
  onOpenChange,
  open,
  overlayClassName,
  showClose = true,
  title
}: BottomSheetProps) => {
  const [mounted, setMounted] = React.useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const close = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);
  const closeWithHaptic = React.useCallback(() => {
    tmaHaptics.impact("light");
    close();
  }, [close]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const scrollY = window.scrollY;
    const { body, documentElement } = document;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlOverscrollBehavior = documentElement.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      window.removeEventListener("keydown", onKeyDown);
      window.scrollTo(0, scrollY);
    };
  }, [close, open]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 isolate overscroll-contain">
          <motion.button
            aria-label={closeLabel}
            className={cn(
              "absolute inset-0 cursor-default bg-black/[0.24] dark:bg-black/[0.42]",
              overlayClassName
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            type="button"
            onClick={close}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(14px,var(--iz-safe-bottom),var(--iz-content-safe-bottom))]">
            <motion.section
              aria-describedby={description ? descriptionId : undefined}
              aria-labelledby={title ? titleId : undefined}
              aria-modal="true"
              className={cn(
                "pointer-events-auto relative max-h-[calc(100svh-24px)] w-full max-w-[560px] overflow-hidden rounded-[38px] transform-gpu",
                "bg-surface-2 text-foreground ring-1 ring-foreground/[0.055]",
                "dark:bg-[#1C1C1E] dark:ring-white/[0.07]",
                className
              )}
              initial={{ opacity: 0, scale: 0.988, y: 34 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.994,
                y: 28
              }}
              role="dialog"
              transition={sheetTransition}
            >
              <div className="grid gap-6 px-5 pb-6 pt-5">
                <header className="grid min-h-11 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 text-center">
                  <div className="grid place-items-start">
                    {showClose ? (
                      <button
                        aria-label={closeLabel}
                        className="grid size-11 place-items-center rounded-full bg-foreground/[0.075] text-foreground transition-colors active:bg-foreground/[0.12] dark:bg-white/[0.1] dark:active:bg-white/[0.16]"
                        type="button"
                        onClick={closeWithHaptic}
                      >
                        <X size={24} strokeWidth={2.15} />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid min-w-0 justify-items-center gap-1.5">
                    {title ? (
                      <h2
                        id={titleId}
                        className="ios-headline min-w-0 max-w-full truncate font-semibold text-foreground"
                      >
                        {title}
                      </h2>
                    ) : null}
                    {description ? (
                      <p id={descriptionId} className="ios-footnote text-muted">
                        {description}
                      </p>
                    ) : null}
                  </div>

                  <div aria-hidden="true" />
                </header>

                <div className={contentClassName}>{children}</div>
              </div>
            </motion.section>
          </div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};
