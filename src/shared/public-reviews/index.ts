import { z } from "zod";

import {
  PUBLIC_REVIEW_LINK_ID_MAX_LENGTH,
  PUBLIC_REVIEW_PROVIDER_IDS,
  type PublicReviewProviderId
} from "~/shared/module-settings";

export const createExternalReviewClickRequestSchema = z
  .object({
    guestEntryScanId: z.string().trim().min(1).max(120).optional(),
    linkId: z.string().trim().min(1).max(PUBLIC_REVIEW_LINK_ID_MAX_LENGTH),
    organizationId: z.string().trim().min(1),
    submissionId: z.string().trim().min(1)
  })
  .strict();

export type CreateExternalReviewClickRequest = z.infer<
  typeof createExternalReviewClickRequestSchema
>;

export type ExternalReviewClickResponsePayload = {
  url: string;
};

export type PublicReviewProviderMetric = {
  count: number;
  provider: PublicReviewProviderId;
};

export type PublicReviewLinkMetric = {
  count: number;
  linkId: string;
  provider: PublicReviewProviderId;
};

export type PublicReviewMetricsPayload = {
  links: PublicReviewLinkMetric[];
  organizationId: string;
  providers: PublicReviewProviderMetric[];
  total: number;
};

export const emptyPublicReviewProviderCounts = (): Record<PublicReviewProviderId, number> =>
  Object.fromEntries(PUBLIC_REVIEW_PROVIDER_IDS.map((provider) => [provider, 0])) as Record<
    PublicReviewProviderId,
    number
  >;
