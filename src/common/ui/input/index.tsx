"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/common/utils";
import { Spinner } from "~/common/ui";
import { tmaHaptics } from "~/shared/tma";

const inputVariants = cva(
  "iz-ios-field relative flex items-center gap-2 overflow-hidden font-normal text-foreground outline-none transition-[background-color,border-color,box-shadow,opacity] duration-200",
  {
    variants: {
      variant: {
        filled: ""
      },
      hasError: {
        true: "is-error"
      },
      loading: {
        true: "cursor-wait opacity-80"
      },
      disabledState: {
        true: "cursor-not-allowed opacity-50"
      },
      size: {
        xs: "min-h-11 rounded-full px-4 py-2 ios-footnote",
        sm: "min-h-12 rounded-full px-4 py-2 ios-subhead",
        md: "min-h-[52px] rounded-full px-5 py-3 ios-body",
        lg: "min-h-14 rounded-full px-5 py-3 ios-body",
        xl: "min-h-[60px] rounded-full px-6 py-3.5 ios-title-3"
      },
      wide: {
        true: "w-full"
      }
    },
    defaultVariants: {
      variant: "filled",
      size: "md",
      wide: false,
      hasError: false,
      loading: false,
      disabledState: false
    }
  }
);

interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  addon?: {
    before?: React.ReactNode;
    after?: React.ReactNode;
  };
  loading?: boolean;
  error?: string;
  hint?: React.ReactNode;
  clearLabel?: string;
  clearable?: boolean;
}

const clearableInputTypes = new Set(["email", "number", "search", "tel", "text", "url"]);

const canClearInputType = (type: React.HTMLInputTypeAttribute | undefined) =>
  !type || clearableInputTypes.has(type);

const hasInputValue = (nextValue: InputProps["value"] | InputProps["defaultValue"]) =>
  nextValue !== undefined && nextValue !== null && String(nextValue).length > 0;

const setNativeInputValue = (element: HTMLInputElement, value: string) => {
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;

  valueSetter?.call(element, value);
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      size = "md",
      wide,
      loading,
      addon,
      disabled,
      error,
      hint,
      clearLabel,
      clearable = true,
      readOnly,
      type,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const spinnerSizeMap = {
      xs: 14,
      sm: 16,
      md: 18,
      lg: 20,
      xl: 22
    } as const;

    const spinnerSize = spinnerSizeMap[size ?? "md"];

    const inputRef = React.useRef<HTMLInputElement>(null);
    const [hasValue, setHasValue] = React.useState(() => hasInputValue(value ?? defaultValue));
    const feedbackMessage = error || hint || null;
    const isError = Boolean(error);
    const isDisabled = disabled || loading;
    const canReserveClearButton = clearable && canClearInputType(type) && !readOnly;
    const showClearButton = canReserveClearButton && !isDisabled && hasValue;
    const shouldRenderTrailingSlot = loading || canReserveClearButton || Boolean(addon?.after);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;

        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref]
    );

    React.useEffect(() => {
      if (value !== undefined) {
        setHasValue(String(value).length > 0);
      }
    }, [value]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(event.currentTarget.value.length > 0);
      onChange?.(event);
    };

    const clearInput = () => {
      const input = inputRef.current;

      if (!input) return;

      setNativeInputValue(input, "");
      setHasValue(false);
      tmaHaptics.selection();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    };

    return (
      <div className={cn("flex flex-col", wide && "w-full")}>
        <div
          className={cn(
            inputVariants({
              variant,
              size,
              wide,
              loading,
              hasError: !!error,
              disabledState: isDisabled
            }),
            className
          )}
        >
          {addon?.before && (
            <div className="relative z-10 -ml-0.5 flex shrink-0 items-center text-muted">
              {addon.before}
            </div>
          )}

          <div className="relative z-10 flex min-w-0 flex-1 items-center">
            <input
              ref={setRefs}
              disabled={isDisabled}
              readOnly={readOnly}
              type={type}
              value={value}
              defaultValue={defaultValue}
              onChange={handleChange}
              className={cn(
                "min-w-0 flex-1 border-none bg-transparent font-normal text-foreground caret-primary outline-none placeholder:text-placeholder selection:bg-primary/20 disabled:cursor-not-allowed",
                size === "xs" && "ios-footnote",
                size === "sm" && "ios-subhead",
                size === "md" && "ios-body",
                size === "lg" && "ios-body",
                size === "xl" && "ios-title-3"
              )}
              {...props}
            />

            {shouldRenderTrailingSlot ? (
              <div className="relative z-10 ml-2 flex min-w-6 shrink-0 items-center justify-end gap-1 text-muted">
                {loading ? (
                  <span className="grid size-6 place-items-center">
                    <Spinner size={spinnerSize} />
                  </span>
                ) : canReserveClearButton ? (
                  <button
                    aria-label={clearLabel}
                    className={cn(
                      "relative grid size-5 place-items-center rounded-full bg-foreground/16 text-surface-2 transition-[background-color,opacity] active:bg-foreground/22 dark:bg-white/24 dark:text-[#1c1c1e] dark:active:bg-white/30 [&_svg]:absolute [&_svg]:left-1/2 [&_svg]:top-1/2 [&_svg]:block [&_svg]:-translate-x-1/2 [&_svg]:-translate-y-1/2",
                      !showClearButton && "hidden"
                    )}
                    tabIndex={-1}
                    type="button"
                    onClick={clearInput}
                  >
                    <X size={11} strokeWidth={3.2} />
                  </button>
                ) : null}
                {canReserveClearButton && !loading && !showClearButton ? (
                  <span aria-hidden="true" className="size-5" />
                ) : null}
                {addon?.after}
              </div>
            ) : null}
          </div>
        </div>

        {feedbackMessage ? (
          <p
            className={cn(
              "ios-footnote px-1 pt-3 pb-0.5 font-normal",
              isError ? "text-danger" : "text-muted"
            )}
          >
            {feedbackMessage}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
