import { cn, getAvatarFallbackStyle, getInitials, hasImageUrl } from "~/common/utils";

type AvatarProps = {
  alt: string;
  className?: string;
  imageClassName?: string;
  initialsClassName?: string;
  name: string;
  seed?: string;
  src?: string | null;
};

export const Avatar = ({
  alt,
  className,
  imageClassName,
  initialsClassName,
  name,
  seed,
  src
}: AvatarProps) => {
  const resolvedSeed = seed?.trim() || name.trim() || "avatar";
  const initials = getInitials(name);
  const showImage = hasImageUrl(src);

  return (
    <div
      className={cn(
        "iz-glass iz-liquid-control relative flex items-center justify-center overflow-hidden bg-surface-2 text-white",
        className
      )}
      style={!showImage ? getAvatarFallbackStyle(resolvedSeed) : undefined}
      role={!showImage ? "img" : undefined}
      aria-label={!showImage ? alt : undefined}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className={cn("h-full w-full object-cover object-center", imageClassName)}
        />
      ) : (
        <span className={cn("select-none font-semibold", initialsClassName)}>{initials}</span>
      )}
    </div>
  );
};
