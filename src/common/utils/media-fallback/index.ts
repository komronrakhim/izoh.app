import type { CSSProperties } from "react";

export const hasImageUrl = (value?: string | null): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const stringToHue = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }

  return Math.abs(hash);
};

export const getInitials = (value: string, limit = 2) => {
  const parts = value.trim().split(/\s+/u).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  return parts
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, limit)
    .toUpperCase();
};

export const getAvatarFallbackStyle = (seed: string): CSSProperties => {
  const baseHue = stringToHue(seed || "avatar");
  const seedColor = `hsl(${baseHue} 62% 38%)`;
  const seedShadowColor = `hsl(${(baseHue + 28) % 360} 56% 24%)`;

  return {
    backgroundImage: `radial-gradient(circle at 28% 22%, color-mix(in srgb, var(--wall-accent, ${seedColor}) 76%, white 18%), transparent 52%), linear-gradient(145deg, color-mix(in srgb, var(--wall-accent, ${seedColor}) 72%, ${seedColor} 28%) 0%, color-mix(in srgb, var(--wall-accent, ${seedShadowColor}) 42%, ${seedShadowColor} 58%) 100%)`
  };
};

export const getCoverFallbackStyle = (seed: string): CSSProperties => {
  const baseHue = stringToHue(seed || "cover");
  const seedColor = `hsl(${baseHue} 82% 58%)`;
  const seedCompanionColor = `hsl(${(baseHue + 82) % 360} 68% 44%)`;

  return {
    backgroundColor:
      "color-mix(in srgb, var(--wall-panel, var(--color-surface-2)) 72%, var(--wall-accent, #ff6b4a) 28%)",
    backgroundImage: `radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--wall-accent, ${seedColor}) 72%, white 14%), transparent 38%), radial-gradient(circle at 86% 76%, color-mix(in srgb, var(--wall-accent, ${seedCompanionColor}) 38%, ${seedCompanionColor} 28%), transparent 42%), linear-gradient(145deg, color-mix(in srgb, var(--wall-accent, ${seedColor}) 34%, var(--wall-panel, var(--color-surface)) 66%) 0%, color-mix(in srgb, var(--wall-background, var(--color-surface-2)) 54%, var(--wall-accent, ${seedCompanionColor}) 30%) 100%)`
  };
};
