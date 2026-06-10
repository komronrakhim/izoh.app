import { cn } from "~/common/utils";

type LogoProps = {
  variant?: "mark" | "full";
  className?: string;
};

const LogoFull = ({ className }: { className?: string }) => {
  return (
    <span
      className={cn(
        "ios-title-2 inline-flex shrink-0 items-center gap-2 font-brand font-semibold tracking-normal",
        className
      )}
    >
      <LogoMark className="size-7 text-primary" />
      <span>Wall</span>
    </span>
  );
};

const LogoMark = ({ className }: { className?: string }) => {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="h-full w-full"
      >
        <path
          d="M16 2.5c7.45 0 13.5 5.55 13.5 12.39 0 8.05-8.28 12.7-12.04 14.46a3.43 3.43 0 0 1-2.92 0C10.78 27.59 2.5 22.94 2.5 14.89 2.5 8.05 8.55 2.5 16 2.5Z"
          fill="currentColor"
        />
        <path
          d="M16 9.1c.49 1.56 1.67 2.78 3.18 3.3-1.51.52-2.69 1.74-3.18 3.3-.49-1.56-1.67-2.78-3.18-3.3 1.51-.52 2.69-1.74 3.18-3.3Z"
          fill="white"
        />
      </svg>
    </span>
  );
};

export const Logo = ({ variant = "mark", className }: LogoProps) => {
  if (variant === "full") {
    return <LogoFull className={cn("h-8 w-[7rem]", className)} />;
  }

  return <LogoMark className={cn("size-8", className)} />;
};
