"use client";

import * as React from "react";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "~/common/utils";

const DEFAULT_DROPDOWN_VIEW = "root";
const DROPDOWN_TRANSITION = {
  duration: 0.13,
  ease: [0.22, 1, 0.36, 1] as const
};
const DROPDOWN_VIEW_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const
};
const DROPDOWN_HEIGHT_TRANSITION = {
  duration: 0.12,
  ease: [0.22, 1, 0.36, 1] as const
};

type DropdownMenuProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "center" | "end" | "start";
  className?: string;
  initialView?: string;
  modal?: boolean;
  onOpenChange?: (open: boolean) => void;
  preventCloseAutoFocus?: boolean;
  side?: "bottom" | "left" | "right" | "top";
  size?: "md" | "sm";
};

type DropdownViewDirection = "back" | "forward";

type DropdownNavigationContextValue = {
  activeView: string;
  direction: DropdownViewDirection;
  setView: (view: string, direction?: DropdownViewDirection) => void;
};

const DropdownSizeContext = React.createContext<NonNullable<DropdownMenuProps["size"]>>("md");
const DropdownNavigationContext = React.createContext<DropdownNavigationContextValue | null>(null);

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  children,
  align = "end",
  className,
  initialView = DEFAULT_DROPDOWN_VIEW,
  modal = false,
  onOpenChange,
  preventCloseAutoFocus = false,
  side = "bottom",
  size = "md"
}) => {
  const [open, setOpen] = React.useState(false);
  const [activeView, setActiveView] = React.useState(initialView);
  const [direction, setDirection] = React.useState<DropdownViewDirection>("forward");

  const setView = React.useCallback(
    (view: string, nextDirection: DropdownViewDirection = "forward") => {
      setDirection(nextDirection);
      setActiveView(view);
    },
    []
  );

  const navigationContext = React.useMemo(
    () => ({
      activeView,
      direction,
      setView
    }),
    [activeView, direction, setView]
  );

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDirection("forward");
        setActiveView(initialView);
      }

      setOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [initialView, onOpenChange]
  );

  return (
    <RadixDropdown.Root modal={modal} open={open} onOpenChange={handleOpenChange}>
      <RadixDropdown.Trigger asChild>{trigger}</RadixDropdown.Trigger>
      <AnimatePresence>
        {open && (
          <RadixDropdown.Portal forceMount>
            <RadixDropdown.Content
              asChild
              align={align}
              side={side}
              sideOffset={6}
              onCloseAutoFocus={(event) => {
                if (preventCloseAutoFocus) {
                  event.preventDefault();
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={DROPDOWN_TRANSITION}
                style={{ transformOrigin: "var(--radix-dropdown-menu-content-transform-origin)" }}
                className={cn(
                  "iz-glass iz-liquid-floating relative z-50 w-max max-w-[calc(100vw-1rem)] select-none overflow-hidden rounded-[22px] text-foreground will-change-[opacity,transform]",
                  size === "sm" ? "min-w-[206px] p-1.5 ios-footnote" : "min-w-48 p-1.5 ios-subhead",
                  className
                )}
              >
                <DropdownSizeContext.Provider value={size}>
                  <DropdownNavigationContext.Provider value={navigationContext}>
                    {children}
                  </DropdownNavigationContext.Provider>
                </DropdownSizeContext.Provider>
              </motion.div>
            </RadixDropdown.Content>
          </RadixDropdown.Portal>
        )}
      </AnimatePresence>
    </RadixDropdown.Root>
  );
};

type DropdownItemProps = React.ComponentPropsWithoutRef<typeof RadixDropdown.Item> & {
  icon?: React.ReactNode;
  tone?: "default" | "destructive";
  trailingIcon?: React.ReactNode;
};

export const DropdownItem = React.forwardRef<HTMLDivElement, DropdownItemProps>(
  ({ className, icon, tone = "default", trailingIcon, children, ...props }, ref) => {
    const size = React.useContext(DropdownSizeContext);
    const isDestructive = tone === "destructive";

    return (
      <RadixDropdown.Item
        ref={ref}
        className={cn(
          "flex w-full cursor-pointer items-center outline-none transition-[background-color,color] duration-150 data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
          size === "sm"
            ? "min-h-11 gap-2.5 rounded-[14px] px-3.5 py-2 font-medium"
            : "min-h-11 gap-2.5 rounded-[14px] px-3.5 py-2.5 font-medium",
          isDestructive
            ? "text-danger data-[highlighted]:bg-danger/10 data-[highlighted]:text-danger"
            : "text-foreground data-[highlighted]:bg-foreground/[0.055] data-[highlighted]:text-foreground dark:data-[highlighted]:bg-white/[0.08]",
          className
        )}
        {...props}
      >
        <span className="flex w-full min-w-0 items-center gap-2">
          {icon ? (
            <span
              className={cn(
                "grid shrink-0 place-items-center text-current",
                size === "sm" ? "min-w-[18px]" : ""
              )}
            >
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 text-current">{children}</span>
          {trailingIcon ? (
            <span className="grid shrink-0 place-items-center text-current opacity-70">
              {trailingIcon}
            </span>
          ) : null}
        </span>
      </RadixDropdown.Item>
    );
  }
);

DropdownItem.displayName = "DropdownItem";

type DropdownViewProps = {
  children: React.ReactNode;
  className?: string;
  value: string;
};

type DropdownViewsProps = {
  children: React.ReactNode;
  className?: string;
};

const dropdownViewVariants = {
  enter: (direction: DropdownViewDirection) => ({
    filter: "blur(1.5px)",
    opacity: 0,
    x: direction === "forward" ? 6 : -6
  }),
  center: {
    filter: "blur(0px)",
    opacity: 1,
    x: 0
  },
  exit: (direction: DropdownViewDirection) => ({
    filter: "blur(1.5px)",
    opacity: 0,
    x: direction === "forward" ? -6 : 6
  })
};

export const DropdownViews = ({ children, className }: DropdownViewsProps) => {
  const navigation = React.useContext(DropdownNavigationContext);
  const activeViewRef = React.useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = React.useState<number | "auto">("auto");

  const activeView = navigation
    ? React.Children.toArray(children).find(
        (child): child is React.ReactElement<DropdownViewProps> =>
          React.isValidElement<DropdownViewProps>(child) &&
          child.props.value === navigation.activeView
      )
    : null;

  React.useLayoutEffect(() => {
    const node = activeViewRef.current;

    if (!node || !navigation) return;

    const updateHeight = () => {
      setHeight(node.offsetHeight);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeView, navigation]);

  if (!navigation) return null;

  return (
    <motion.div
      animate={{ height }}
      initial={false}
      transition={DROPDOWN_HEIGHT_TRANSITION}
      className={cn("relative overflow-hidden", className)}
    >
      <AnimatePresence custom={navigation.direction} initial={false} mode="popLayout">
        {activeView ? (
          <motion.div
            ref={activeViewRef}
            key={navigation.activeView}
            custom={navigation.direction}
            variants={dropdownViewVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={DROPDOWN_VIEW_TRANSITION}
            className={cn("will-change-[filter,opacity,transform]", activeView.props.className)}
          >
            {activeView.props.children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
};

export const DropdownView = ({ children, className, value }: DropdownViewProps) => {
  const navigation = React.useContext(DropdownNavigationContext);

  if (!navigation) return null;

  const offset = navigation.direction === "forward" ? 10 : -10;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {navigation.activeView === value ? (
        <motion.div
          key={value}
          initial={{ opacity: 0, x: offset }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -offset }}
          transition={{
            duration: 0.14,
            ease: [0.22, 1, 0.36, 1]
          }}
          className={className}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

type DropdownViewItemProps = Omit<DropdownItemProps, "trailingIcon"> & {
  direction?: DropdownViewDirection;
  hideIndicator?: boolean;
  view: string;
};

export const DropdownViewItem = React.forwardRef<HTMLDivElement, DropdownViewItemProps>(
  ({ children, direction = "forward", hideIndicator = false, onSelect, view, ...props }, ref) => {
    const navigation = React.useContext(DropdownNavigationContext);

    return (
      <DropdownItem
        ref={ref}
        trailingIcon={hideIndicator ? null : <ChevronRight size={15} />}
        onSelect={(event) => {
          event.preventDefault();
          onSelect?.(event);
          navigation?.setView(view, direction);
        }}
        {...props}
      >
        {children}
      </DropdownItem>
    );
  }
);

DropdownViewItem.displayName = "DropdownViewItem";

type DropdownViewHeaderProps = {
  backLabel?: string;
  backTo: string;
  className?: string;
  title: string;
};

export const DropdownViewHeader = ({
  backLabel = "Back",
  backTo,
  className,
  title
}: DropdownViewHeaderProps) => {
  const navigation = React.useContext(DropdownNavigationContext);
  const size = React.useContext(DropdownSizeContext);

  return (
    <div className={cn("grid grid-cols-[44px_minmax(0,1fr)_44px] items-center px-1.5", className)}>
      <button
        type="button"
        aria-label={backLabel}
        title={backLabel}
        className={cn(
          "grid place-items-center rounded-full text-muted outline-none transition-[background-color,color] hover:bg-surface/58 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/35 dark:hover:bg-white/[0.08]",
          "size-11"
        )}
        onClick={() => navigation?.setView(backTo, "back")}
      >
        <ChevronLeft size={size === "sm" ? 16 : 17} />
      </button>
      <div className="ios-footnote min-w-0 text-center font-semibold text-foreground">{title}</div>
    </div>
  );
};

export const DropdownSeparator = () => (
  <DropdownSizeContext.Consumer>
    {(size) => (
      <RadixDropdown.Separator
        className={cn(
          size === "sm"
            ? "mx-3 my-1.5 border-t border-foreground/[0.08] dark:border-white/[0.08]"
            : "mx-2 my-1.5 border-t border-foreground/[0.08] dark:border-white/[0.08]"
        )}
      />
    )}
  </DropdownSizeContext.Consumer>
);
