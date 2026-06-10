import type { ReactNode } from "react";

import { cn, getCoverFallbackStyle, hasImageUrl } from "~/common/utils";

type CoverSurfaceProps = {
  alt: string;
  children?: ReactNode;
  className?: string;
  imageClassName?: string;
  seed: string;
  src?: string | null;
};

export const CoverSurface = ({
  alt,
  children,
  className,
  imageClassName,
  seed,
  src
}: CoverSurfaceProps) => {
  const resolvedSeed = seed.trim() || "cover";
  const showImage = hasImageUrl(src);

  return (
    <div
      className={cn("iz-glass iz-liquid-list relative overflow-hidden bg-surface-2", className)}
      style={!showImage ? getCoverFallbackStyle(resolvedSeed) : undefined}
      role={!showImage ? "img" : undefined}
      aria-label={!showImage ? alt : undefined}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className={cn("h-full w-full object-cover object-center", imageClassName)}
        />
      ) : null}

      {children}
    </div>
  );
};
