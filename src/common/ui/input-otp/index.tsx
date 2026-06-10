"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { animate, AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { OTPInput, type SlotProps } from "input-otp";
import { cn } from "~/common/utils";

const otpVariants = cva(
  "flex items-center justify-center gap-3 rounded-lg font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "py-2",
        md: "py-3",
        lg: "py-4"
      },
      wide: {
        true: "w-full"
      }
    },
    defaultVariants: {
      size: "md",
      wide: false
    }
  }
);

const slotSizeMap = {
  sm: "size-11 ios-body",
  md: "h-[52px] w-[48px] ios-title-3",
  lg: "h-[62px] w-[54px] ios-title-2"
} as const;

type OtpActiveRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export interface OtpInputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange">,
    VariantProps<typeof otpVariants> {
  value?: string;
  onChange?: (val: string) => void;
  length?: number;
  loading?: boolean;
  error?: string;
  placeholder?: string;
}

export const OtpInput = React.forwardRef<HTMLInputElement, OtpInputProps>(
  (
    {
      className,
      size = "md",
      wide,
      loading = false,
      error,
      length = 6,
      value = "",
      onChange,
      disabled,
      placeholder = "•"
    },
    ref
  ) => {
    const [activeRect, setActiveRect] = React.useState<OtpActiveRect | null>(null);
    const [isFocused, setIsFocused] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const prevRect = React.useRef<OtpActiveRect | null>(null);

    const scaleValue = useMotionValue(1);
    const ringScale = useSpring(scaleValue, {
      stiffness: 480,
      damping: 28,
      mass: 0.4
    });

    const errorRef = React.useRef<HTMLDivElement>(null);
    const [errorHeight, setErrorHeight] = React.useState(0);

    React.useEffect(() => {
      if (!activeRect || !prevRect.current) {
        prevRect.current = activeRect;
        return;
      }
      const moved =
        activeRect.left !== prevRect.current.left || activeRect.top !== prevRect.current.top;
      if (moved) {
        animate(scaleValue, [0.96, 1.02, 1], {
          duration: 0.22,
          ease: "easeOut"
        });
        prevRect.current = activeRect;
      }
    }, [activeRect, scaleValue]);

    React.useEffect(() => {
      if (!isFocused || value.length !== 0) return;
      const firstSlot = containerRef.current?.querySelector("div[data-slot='0']");
      if (!firstSlot) return;
      const node = firstSlot as HTMLDivElement;
      setActiveRect({
        left: node.offsetLeft,
        top: node.offsetTop,
        width: node.offsetWidth,
        height: node.offsetHeight
      });
    }, [isFocused, value]);

    React.useLayoutEffect(() => {
      setErrorHeight(error ? (errorRef.current?.scrollHeight ?? 0) : 0);
    }, [error]);

    return (
      <div className="flex flex-col">
        <motion.div
          layout
          transition={{ duration: 0.25 }}
          className={cn(otpVariants({ size, wide }), "relative flex-col", className)}
        >
          <div
            ref={containerRef}
            className={cn("relative", loading && "opacity-60 pointer-events-none")}
            onFocusCapture={() => setIsFocused(true)}
            onBlurCapture={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                return;
              }
              setIsFocused(false);
            }}
          >
            <OTPInput
              ref={ref}
              value={value}
              onChange={onChange}
              maxLength={length}
              containerClassName="group flex items-center justify-center"
              disabled={disabled || loading}
              render={({ slots }) => (
                <div className="flex gap-3 relative">
                  {slots.map((slot, i) => (
                    <Slot
                      key={i}
                      {...slot}
                      index={i}
                      size={size ?? "md"}
                      setActiveRect={setActiveRect}
                      placeholder={placeholder}
                      hasError={Boolean(error)}
                    />
                  ))}

                  <AnimatePresence>
                    {!loading && isFocused && activeRect && (
                      <motion.div
                        layoutId="otp-ring"
                        className={cn(
                          "pointer-events-none absolute rounded-xl border-transparent ring-2 ring-offset-1 ring-offset-surface",
                          error ? "ring-danger" : "ring-primary"
                        )}
                        style={{
                          top: activeRect.top,
                          left: activeRect.left,
                          width: activeRect.width,
                          height: activeRect.height,
                          scale: ringScale
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 520,
                          damping: 28,
                          mass: 0.45
                        }}
                      />
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {loading && (
                      <motion.div
                        key="shimmer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 overflow-hidden rounded-xl"
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/8 to-transparent"
                          animate={{
                            x: ["-100%", "100%"]
                          }}
                          transition={{
                            duration: 1.4,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            />
          </div>
        </motion.div>

        <motion.div
          animate={{
            height: errorHeight,
            opacity: error ? 1 : 0,
            y: error ? 0 : -8
          }}
          initial={{ height: 0, opacity: 0, y: -8 }}
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 34,
            mass: 0.6
          }}
          className="overflow-hidden"
          style={{
            willChange: "transform, opacity, height",
            paddingBottom: "2px"
          }}
        >
          <div ref={errorRef}>
            <AnimatePresence mode="popLayout">
              {error && (
                <motion.p
                  key={error}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{
                    duration: 0.12,
                    ease: "easeOut"
                  }}
                  className="ios-footnote px-1 pt-3 text-center font-normal text-danger"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }
);

OtpInput.displayName = "OtpInput";

const Slot = ({
  char,
  isActive,
  size,
  setActiveRect,
  placeholder,
  index,
  hasError
}: SlotProps & {
  index: number;
  size: keyof typeof slotSizeMap;
  setActiveRect: (rect: OtpActiveRect | null) => void;
  placeholder: string;
  hasError: boolean;
}) => {
  const elRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (isActive && elRef.current) {
      setActiveRect({
        left: elRef.current.offsetLeft,
        top: elRef.current.offsetTop,
        width: elRef.current.offsetWidth,
        height: elRef.current.offsetHeight
      });
    }
  }, [isActive, setActiveRect]);

  const sizeClass = slotSizeMap[size];

  return (
    <div
      ref={elRef}
      data-slot={index}
      className={cn(
        "iz-glass iz-liquid-field relative flex items-center justify-center rounded-[16px] border font-semibold text-foreground select-none transition-[background-color,border-color,color,transform] duration-150 ease-out",
        hasError ? "border-danger/30" : "border-transparent",
        sizeClass
      )}
    >
      <AnimatePresence mode="popLayout">
        {char !== null ? (
          <motion.div
            key={char}
            initial={{ opacity: 0, y: 3, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -3, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 32,
              mass: 0.55
            }}
          >
            {char}
          </motion.div>
        ) : (
          <motion.span
            key={`placeholder-${index}`}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 0.6, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.14 }}
            className="text-placeholder"
          >
            {placeholder}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};
