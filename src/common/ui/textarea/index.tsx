"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/common/utils";

const textareaVariants = cva(
  "iz-ios-field relative w-full resize-none rounded-[28px] font-normal text-foreground placeholder:text-placeholder outline-none ring-offset-surface transition-[background-color,border-color,box-shadow,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        filled: "",
        outline: ""
      },
      hasError: {
        true: "is-error"
      },
      size: {
        sm: "ios-subhead px-4 py-3",
        md: "ios-body px-5 py-4",
        lg: "ios-body px-5 py-4.5"
      }
    },
    defaultVariants: {
      variant: "filled",
      size: "md",
      hasError: false
    }
  }
);

interface TextareaProps
  extends
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    VariantProps<typeof textareaVariants> {
  autoresize?: boolean | { maxHeight: number };
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { className, variant, size = "md", autoresize = false, value, defaultValue, error, ...props },
    ref
  ) => {
    const maxHeight =
      typeof autoresize === "object" ? autoresize.maxHeight : Number.POSITIVE_INFINITY;

    const [height, setHeight] = React.useState(0);
    const [isOverflowing, setIsOverflowing] = React.useState(false);

    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const measureRef = React.useRef<HTMLTextAreaElement>(null);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    const updateHeight = React.useCallback(() => {
      if (!autoresize || !measureRef.current) return;

      const measureEl = measureRef.current;
      const currentValue = textareaRef.current?.value ?? String(value ?? defaultValue ?? "");

      measureEl.value = currentValue;

      const measuredHeight = measureEl.scrollHeight;
      const clampedHeight = Math.min(measuredHeight, maxHeight);

      setHeight(clampedHeight);
      setIsOverflowing(measuredHeight > maxHeight);
    }, [autoresize, maxHeight, value, defaultValue]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoresize) {
        requestAnimationFrame(() => {
          updateHeight();
        });
      }
      props.onChange?.(e);
    };

    React.useLayoutEffect(() => {
      const timeoutId = setTimeout(() => {
        updateHeight();
      }, 0);

      return () => clearTimeout(timeoutId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useLayoutEffect(() => {
      updateHeight();
    }, [size, autoresize, updateHeight]);

    React.useLayoutEffect(() => {
      if (value !== undefined) {
        updateHeight();
      }
    }, [value, updateHeight]);

    return (
      <div className="flex flex-col">
        <div className="relative w-full">
          {autoresize && (
            <textarea
              ref={measureRef}
              className={cn(
                textareaVariants({ variant, size }),
                "absolute left-0 top-0 invisible h-auto overflow-hidden pointer-events-none whitespace-pre-wrap break-words"
              )}
              readOnly
              aria-hidden="true"
              tabIndex={-1}
            />
          )}

          <div
            className="w-full"
            style={{
              ...(autoresize && {
                height: `${height}px`
              })
            }}
          >
            <textarea
              {...props}
              ref={setRefs}
              value={value}
              defaultValue={defaultValue}
              onChange={handleChange}
              className={cn(
                textareaVariants({ variant, size, hasError: !!error }),
                "w-full scrollbar-hide whitespace-pre-wrap break-words caret-primary selection:bg-primary/20",
                isOverflowing ? "overflow-y-auto" : "overflow-hidden",
                className
              )}
              style={{
                ...(autoresize && {
                  height: `${height}px`,
                  maxHeight: maxHeight !== Number.POSITIVE_INFINITY ? `${maxHeight}px` : undefined
                })
              }}
            />
          </div>
        </div>

        {error ? (
          <p
            className={cn(
              "ios-footnote px-1 pb-0.5 font-normal text-danger",
              autoresize ? "pt-3" : "pt-2"
            )}
          >
            {error}
          </p>
        ) : null}

        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            width: 0;
            height: 0;
          }
          .scrollbar-hide {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
        `}</style>
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
