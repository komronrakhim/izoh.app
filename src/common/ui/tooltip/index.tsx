"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "~/common/utils";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

type Position = {
  top: number;
  left: number;
};

export const Tooltip = ({ content, children, className, contentClassName }: TooltipProps) => {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<Position | null>(null);

  const updatePosition = React.useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  return (
    <span
      ref={ref}
      className={cn("inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children}
      {open && position
        ? createPortal(
            <span
              role="tooltip"
              className={cn(
                "iz-glass iz-liquid-floating ios-caption-1 fixed z-50 -translate-x-1/2 whitespace-nowrap rounded-[10px] px-2 py-1 text-foreground",
                "animate-[pageFadeIn_120ms_ease-out]",
                contentClassName
              )}
              style={{ top: position.top, left: position.left }}
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </span>
  );
};
