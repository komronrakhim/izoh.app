"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/common/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

const badgeVariants = cva("relative inline-flex items-center rounded-full font-medium", {
  variants: {
    variant: {
      neutral: "iz-glass iz-liquid-control text-muted",
      info: "border border-primary/14 bg-primary/10 text-primary backdrop-blur-md",
      warning: "border border-warning/16 bg-warning/15 text-warning backdrop-blur-md",
      success: "border border-success/16 bg-success/14 text-success backdrop-blur-md",
      danger: "border border-danger/16 bg-danger/12 text-danger backdrop-blur-md",
      dark: "bg-foreground text-surface"
    },
    size: {
      sm: "px-2 py-1 ios-caption-1",
      md: "px-2.5 py-1 ios-caption-1"
    }
  },
  defaultVariants: {
    variant: "neutral",
    size: "sm"
  }
});

export const Badge = ({ className, variant, size, ...props }: BadgeProps) => {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
};
