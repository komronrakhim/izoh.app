"use client";

import * as React from "react";
import * as Switch from "@radix-ui/react-switch";
import { cn } from "~/common/utils";
import { tmaHaptics } from "~/shared/tma";

type ToggleProps = React.ComponentPropsWithoutRef<typeof Switch.Root>;

export const Toggle = ({ className, disabled, onCheckedChange, ...props }: ToggleProps) => {
  const handleCheckedChange = (checked: boolean) => {
    if (!disabled) {
      tmaHaptics.selection();
    }

    onCheckedChange?.(checked);
  };

  return (
    <Switch.Root
      className={cn(
        "relative inline-flex h-[var(--iz-ios-switch-height)] w-[var(--iz-ios-switch-width)] shrink-0 items-center rounded-full border p-[2px] transition-[background-color,border-color,box-shadow,filter] duration-300 ease-out",
        "border-foreground/[0.08] bg-foreground/[0.12] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_3px_10px_rgba(0,0,0,0.04)] backdrop-blur-xl backdrop-saturate-150",
        "data-[state=checked]:border-success data-[state=checked]:bg-success data-[state=checked]:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_3px_10px_rgba(52,199,89,0.22)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "disabled:cursor-not-allowed disabled:opacity-50 data-[state=unchecked]:hover:bg-foreground/[0.16]",
        className
      )}
      disabled={disabled}
      onCheckedChange={handleCheckedChange}
      {...props}
    >
      <Switch.Thumb
        className={cn(
          "block size-[var(--iz-ios-switch-thumb)] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.22),0_0_0_0.5px_rgba(0,0,0,0.04)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          "data-[state=checked]:translate-x-5"
        )}
      />
    </Switch.Root>
  );
};
