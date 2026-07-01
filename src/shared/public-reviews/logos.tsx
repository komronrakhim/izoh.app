import type * as React from "react";

import type { PublicReviewProviderId } from "~/shared/module-settings";

export type BrandedPublicReviewProviderId = PublicReviewProviderId;
export type PublicReviewProviderLogoProps = React.SVGProps<SVGSVGElement>;

export const GoogleReviewLogo = (props: PublicReviewProviderLogoProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path
      fill="#4285F4"
      d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 .9-3.4.9a5.9 5.9 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
    />
    <path fill="#FBBC05" d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8l3.3-2.6Z" />
    <path
      fill="#EA4335"
      d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.6l3.3 2.6A5.9 5.9 0 0 1 12 6.1Z"
    />
  </svg>
);

export const YandexReviewLogo = (props: PublicReviewProviderLogoProps) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" {...props}>
    <path
      fill="#FF4433"
      d="M8 1C4.6862 1 2 3.6862 2 7c0 1.6563.6711 3.156 1.7565 4.2417C4.8422 12.328 7.4 13.9 7.55 15.55c.0225.2474.2016.45.45.45s.4275-.2026.45-.45c.15-1.65 2.7078-3.222 3.7935-4.3083C13.3289 10.156 14 8.6563 14 7c0-3.3138-2.6862-6-6-6Z"
    />
    <path fill="#fff" d="M8 9.1002A2.1 2.1 0 1 0 8 4.9001a2.1 2.1 0 0 0 0 4.2001Z" />
  </svg>
);

export const TwoGisReviewLogo = (props: PublicReviewProviderLogoProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <rect width="24" height="24" rx="7" fill="#19AA1E" />
    <path
      fill="#fff"
      d="M5.2 16.8h6.1v-1.9H8.7l1.3-1.2c1.1-1 1.5-1.8 1.5-2.9 0-1.8-1.3-3-3.2-3-1.8 0-3.1 1-3.4 2.7l2 .4c.2-.8.7-1.2 1.4-1.2.7 0 1.1.4 1.1 1.1s-.3 1.2-1.1 1.9l-3.1 2.8v1.3Zm10.4.2c2 0 3.4-1.2 3.4-3.2v-2.1h-3.5v1.7h1.5v.5c0 .8-.5 1.3-1.4 1.3-1.1 0-1.7-.9-1.7-2.7 0-1.7.6-2.7 1.8-2.7.8 0 1.3.4 1.6 1.2l1.8-.7c-.5-1.6-1.7-2.5-3.4-2.5-2.4 0-3.9 1.8-3.9 4.7s1.5 4.5 3.8 4.5Z"
    />
  </svg>
);

export const PUBLIC_REVIEW_BRANDED_PROVIDER_IDS = ["google", "yandex", "2gis"] as const;

export const PUBLIC_REVIEW_PROVIDER_LOGOS = {
  "2gis": TwoGisReviewLogo,
  google: GoogleReviewLogo,
  yandex: YandexReviewLogo
} satisfies Record<
  BrandedPublicReviewProviderId,
  React.ComponentType<PublicReviewProviderLogoProps>
>;

export const PUBLIC_REVIEW_PROVIDER_LABELS = {
  "2gis": "2ГИС",
  google: "Google",
  yandex: "Яндекс Карты"
} satisfies Record<BrandedPublicReviewProviderId, string>;

const brandedProviderIds = new Set<PublicReviewProviderId>(PUBLIC_REVIEW_BRANDED_PROVIDER_IDS);

export const isBrandedPublicReviewProviderId = (
  value: PublicReviewProviderId
): value is BrandedPublicReviewProviderId => brandedProviderIds.has(value);
