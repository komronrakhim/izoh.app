"use client";

import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { cn } from "~/common/utils";
import { tmaHaptics } from "~/shared/tma";

export type ListItem = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  addon?: {
    before?: React.ReactNode;
    after?: React.ReactNode;
  };
  variant?: "default" | "destructive";
  disabled?: boolean;
  href?: string;
  isAction?: boolean;
  onClick?: () => void;
};

export type ListProps = {
  items: ListItem[];
  title?: string;
  hint?: React.ReactNode;
  spacing?: "xs" | "sm" | "md";
  className?: string;
};

export type ListIconProps = {
  children: React.ReactNode;
  className?: string;
};

export const ListIcon = ({ children, className }: ListIconProps) => (
  <span
    className={cn(
      "grid size-[30px] shrink-0 place-items-center rounded-[9px] [&>svg]:size-[15.5px]",
      className
    )}
  >
    {children}
  </span>
);

const rowVariants = cva(
  "relative flex w-full items-center text-left select-none transition-[background-color,opacity,filter] duration-150",
  {
    variants: {
      spacing: {
        xs: "min-h-11 px-4 py-2",
        sm: "min-h-[60px] px-4.5 py-3",
        md: "min-h-[68px] px-5 py-3.5"
      },
      variant: {
        default: "",
        destructive: ""
      },
      disabled: {
        false: "",
        true: "opacity-50 cursor-not-allowed"
      },
      isAction: {
        false: "",
        true: ""
      }
    },
    compoundVariants: [
      {
        className:
          "hover:bg-foreground/[0.035] active:bg-foreground/[0.06] dark:hover:bg-white/[0.045] dark:active:bg-white/[0.07]",
        isAction: true,
        variant: "default"
      },
      {
        className: "hover:bg-danger/8",
        isAction: true,
        variant: "destructive"
      }
    ],
    defaultVariants: {
      spacing: "sm",
      variant: "default",
      disabled: false,
      isAction: true
    }
  }
);

const titleVariants = cva("ios-body font-normal", {
  variants: {
    variant: {
      default: "text-foreground",
      destructive: "text-danger"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

const beforeAddonVariants = cva("", {
  variants: {
    variant: {
      default: "text-foreground",
      destructive: "text-danger"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export const List = ({ items, title, hint, spacing = "sm", className }: ListProps) => {
  return (
    <div className="flex w-full flex-col gap-2.5">
      {title && (
        <header className="px-4">
          <h2 className="ios-caption-1 font-semibold uppercase text-muted">{title}</h2>
        </header>
      )}

      <div
        className={cn(
          "iz-liquid-list relative w-full overflow-hidden rounded-[28px] border",
          className
        )}
      >
        {items.map((item, i) => {
          const last = i === items.length - 1;

          return (
            <React.Fragment key={i}>
              <ListRow item={item} spacing={spacing} />
              {!last && (
                <div
                  className="ml-[60px] h-px bg-foreground/[0.085] dark:bg-white/[0.105]"
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {hint && <footer className="ios-footnote px-4 text-muted">{hint}</footer>}
    </div>
  );
};

export const ListRow = ({
  item,
  spacing = "sm"
}: {
  item: ListItem;
  spacing?: "xs" | "sm" | "md";
}) => {
  const isDisabled = item.disabled;
  const isAction = item.isAction ?? true;
  const variant = item.variant ?? "default";

  const onClick = () => {
    if (!isDisabled && item.onClick) {
      tmaHaptics.impact("light");
      item.onClick();
    }
  };

  const onLinkClick = () => {
    if (!isDisabled && isAction) {
      tmaHaptics.impact("light");
    }
  };

  const content = (
    <>
      <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
        {item.addon?.before && (
          <span className={beforeAddonVariants({ variant })}>{item.addon.before}</span>
        )}

        <div className="flex min-w-0 flex-col">
          <span className={titleVariants({ variant })}>{item.title}</span>
          {item.subtitle ? (
            <span className="ios-footnote mt-0.5 text-muted">{item.subtitle}</span>
          ) : null}
        </div>
      </div>

      {item.addon?.after && (
        <span className="relative z-10 flex items-center text-muted">{item.addon.after}</span>
      )}
    </>
  );
  const className = cn(
    rowVariants({ spacing, variant, disabled: isDisabled, isAction: isAction && !isDisabled }),
    isAction && (item.href || item.onClick) ? "cursor-pointer" : "cursor-default"
  );

  if (item.href && !isDisabled) {
    if (item.href.startsWith("/")) {
      return (
        <Link to={item.href as never} className={className} onClick={onLinkClick}>
          {content}
        </Link>
      );
    }

    return (
      <a href={item.href} className={className} onClick={onLinkClick}>
        {content}
      </a>
    );
  }

  if (!isAction) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" disabled={isDisabled} onClick={onClick} className={className}>
      {content}
    </button>
  );
};
