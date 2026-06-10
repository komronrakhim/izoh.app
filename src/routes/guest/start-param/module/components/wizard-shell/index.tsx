import type { CSSProperties, ReactNode } from "react";

import { cn } from "~/common/utils";

type WizardShellProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export const WizardShell = ({ children, className, style }: WizardShellProps) => (
  <main
    className={cn(
      "tma-page tma-page-edge-top relative isolate overflow-x-hidden bg-surface text-foreground",
      className
    )}
    style={style}
  >
    <div className="relative z-10 mx-auto flex min-h-[var(--iz-visual-viewport-height,100dvh)] w-full max-w-[560px] flex-col px-4 pb-[18px] pt-0">
      {children}
    </div>
  </main>
);
