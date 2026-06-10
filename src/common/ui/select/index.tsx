"use client";

import * as React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { cn } from "~/common/utils";

const selectTriggerClass =
  "iz-glass iz-liquid-field ios-touch-target relative inline-flex min-h-11 w-full max-w-full min-w-0 items-center justify-start gap-2 overflow-hidden rounded-[16px] px-4 ios-body text-foreground outline-none transition-[border-color,background-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60";

const selectContentClass =
  "iz-glass iz-liquid-floating relative z-50 w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[22px] p-1.5 text-foreground data-[state=open]:animate-[dialogContentIn_220ms_cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:animate-[dialogContentOut_180ms_ease-in] data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1";

const selectItemClass =
  "ios-touch-target relative flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 ios-body outline-none text-muted data-[state=checked]:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

const selectHoverTransition = {
  type: "spring",
  stiffness: 550,
  damping: 32,
  mass: 0.4
} as const;

const Select = RadixSelect.Root;
const SelectValue = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Value>) => (
  <RadixSelect.Value
    className={cn(
      "block min-w-0 max-w-full flex-1 basis-0 overflow-hidden text-ellipsis whitespace-nowrap text-left",
      className
    )}
    {...props}
  />
);

type SelectHoverContextValue = {
  hoverLayoutId: string;
  activeItemId: string | null;
  activateItem: (id: string) => void;
  deactivateItem: () => void;
  deactivateItemDelayed: () => void;
};

const SelectHoverContext = React.createContext<SelectHoverContextValue | null>(null);

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger> & {
    showChevron?: boolean;
  }
>(({ className, children, showChevron = true, ...props }, ref) => (
  <RadixSelect.Trigger ref={ref} className={cn(selectTriggerClass, className)} {...props}>
    <span className="relative z-10 flex min-w-0 flex-1 items-center overflow-hidden text-left">
      {children}
    </span>
    {showChevron ? (
      <RadixSelect.Icon asChild>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className="relative z-10 ml-2 shrink-0"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </RadixSelect.Icon>
    ) : null}
  </RadixSelect.Trigger>
));

SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content> & {
    searchSlot?: React.ReactNode;
    viewportClassName?: string;
  }
>(({ className, children, position = "popper", searchSlot, viewportClassName, ...props }, ref) => {
  const layoutGroupId = React.useId();
  const hoverLayoutId = React.useMemo(() => `${layoutGroupId}-select-hover-bg`, [layoutGroupId]);
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null);
  const clearHoverTimeoutRef = React.useRef<number | null>(null);

  const clearHoverTimeout = React.useCallback(() => {
    if (clearHoverTimeoutRef.current === null) return;
    window.clearTimeout(clearHoverTimeoutRef.current);
    clearHoverTimeoutRef.current = null;
  }, []);

  const activateItem = React.useCallback(
    (id: string) => {
      clearHoverTimeout();
      setActiveItemId(id);
    },
    [clearHoverTimeout]
  );

  const deactivateItem = React.useCallback(() => {
    clearHoverTimeout();
    setActiveItemId(null);
  }, [clearHoverTimeout]);

  const deactivateItemDelayed = React.useCallback(() => {
    clearHoverTimeout();
    clearHoverTimeoutRef.current = window.setTimeout(() => {
      setActiveItemId(null);
    }, 60);
  }, [clearHoverTimeout]);

  React.useEffect(() => () => clearHoverTimeout(), [clearHoverTimeout]);

  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        ref={ref}
        position={position}
        sideOffset={8}
        className={cn(selectContentClass, className)}
        {...props}
      >
        {searchSlot ? <div className="px-1 pt-1 pb-1">{searchSlot}</div> : null}

        <SelectHoverContext.Provider
          value={{
            hoverLayoutId,
            activeItemId,
            activateItem,
            deactivateItem,
            deactivateItemDelayed
          }}
        >
          <LayoutGroup id={layoutGroupId}>
            <RadixSelect.Viewport
              className={cn("max-h-80 overflow-y-auto overscroll-contain p-0.5", viewportClassName)}
            >
              {children}
            </RadixSelect.Viewport>
          </LayoutGroup>
        </SelectHoverContext.Provider>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
});

SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(({ className, children, ...props }, ref) => {
  const hoverContext = React.useContext(SelectHoverContext);
  const itemId = React.useId();
  const isActive = hoverContext?.activeItemId === itemId;

  return (
    <RadixSelect.Item
      ref={ref}
      onPointerEnter={() => hoverContext?.activateItem(itemId)}
      onPointerLeave={() => hoverContext?.deactivateItemDelayed()}
      onFocus={() => hoverContext?.activateItem(itemId)}
      onBlur={() => hoverContext?.deactivateItem()}
      className={cn(selectItemClass, className)}
      {...props}
    >
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            layoutId={hoverContext?.hoverLayoutId ?? "select-hover-bg"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={selectHoverTransition}
            className="pointer-events-none absolute inset-0 rounded-xl bg-foreground/[0.045]"
          />
        )}
      </AnimatePresence>

      <RadixSelect.ItemText asChild>
        <span className="relative z-10 min-w-0 flex-1 truncate">{children}</span>
      </RadixSelect.ItemText>

      <RadixSelect.ItemIndicator asChild>
        <motion.span
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
});

SelectItem.displayName = "SelectItem";

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
