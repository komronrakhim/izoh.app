"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "~/common/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export const dialogIconButtonClassName =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-[16px] text-muted outline-none ring-0 transition-[background-color,color] duration-150 hover:bg-foreground/[0.055] hover:text-foreground focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 dark:hover:bg-white/[0.08]";

export const DialogIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(dialogIconButtonClassName, className)} {...props} />
));
DialogIconButton.displayName = "DialogIconButton";

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/46 will-change-opacity dark:bg-black/58",
      "data-[state=closed]:pointer-events-none",
      "data-[state=open]:animate-[dialogOverlayIn_220ms_ease-out]",
      "data-[state=closed]:animate-[dialogOverlayOut_180ms_ease-in]",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
  }
>(({ className, children, showClose = true, ...props }, ref) => {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2",
          "iz-glass iz-liquid-floating rounded-[28px] p-6",
          "outline-none ring-0 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0",
          "[animation-fill-mode:both]",
          "data-[state=closed]:pointer-events-none",
          "data-[state=open]:animate-[dialogContentIn_260ms_cubic-bezier(0.22,1,0.36,1)]",
          "data-[state=closed]:animate-[dialogContentOut_200ms_ease-in]",
          className
        )}
        {...props}
      >
        {showClose && (
          <DialogPrimitive.Close asChild>
            <DialogIconButton aria-label="Close dialog" className="absolute right-5 top-5">
              <X size={16} strokeWidth={2.2} />
            </DialogIconButton>
          </DialogPrimitive.Close>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-5 text-center", className)} {...props} />
);

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("ios-headline text-center tracking-normal", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("ios-footnote text-muted", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
