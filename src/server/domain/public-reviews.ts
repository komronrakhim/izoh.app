import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import {
  PUBLIC_REVIEW_PROVIDER_IDS,
  getEnabledPublicReviewLinks,
  parseModuleSettingsConfig,
  type PublicReviewProviderId
} from "~/shared/module-settings";
import {
  emptyPublicReviewProviderCounts,
  type PublicReviewMetricsPayload
} from "~/shared/public-reviews";

type CreateExternalReviewClickInput = {
  guestEntryScanId?: string;
  linkId: string;
  organizationId: string;
  submissionId: string;
};

const isPublicReviewProviderId = (value: string): value is PublicReviewProviderId =>
  PUBLIC_REVIEW_PROVIDER_IDS.includes(value as PublicReviewProviderId);

const getTargetHost = (url: string) => new URL(url).hostname.slice(0, 255);

export const createExternalReviewClick = async (
  { guestEntryScanId, linkId, organizationId, submissionId }: CreateExternalReviewClickInput,
  db: DomainDb = getDomainDb()
) => {
  const submission = await db.submission.findFirst({
    select: {
      guest_entry_scan_id: true,
      id: true,
      kind: true,
      organization: {
        select: {
          module_settings: {
            take: 1,
            where: {
              module: "REVIEW"
            }
          },
          status: true
        }
      },
      organization_id: true,
      rating: true
    },
    where: {
      id: submissionId,
      organization_id: organizationId
    }
  });

  if (!submission || submission.organization.status !== "ACTIVE") {
    throw new Error("Submission is not available.");
  }

  if (submission.kind !== "REVIEW" || typeof submission.rating !== "number") {
    throw new Error("External review link is not available.");
  }

  if (guestEntryScanId && guestEntryScanId !== submission.guest_entry_scan_id) {
    throw new Error("Guest entry scan does not match this submission.");
  }

  const reviewSettings = parseModuleSettingsConfig({
    config: submission.organization.module_settings[0]?.config,
    itemId: "review"
  });
  const link = getEnabledPublicReviewLinks(reviewSettings).find((item) => item.id === linkId);

  if (!reviewSettings.publicReview.enabled || !link) {
    throw new Error("External review link is not available.");
  }

  if (submission.rating < reviewSettings.publicReview.minRating) {
    throw new Error("External review link is not available for this rating.");
  }

  await db.externalReviewClick.create({
    data: {
      guest_entry_scan_id: guestEntryScanId ?? submission.guest_entry_scan_id,
      link_id: link.id,
      organization_id: organizationId,
      provider: link.provider,
      rating: submission.rating,
      submission_id: submission.id,
      target_host: getTargetHost(link.url)
    }
  });

  return {
    url: link.url
  };
};

export const getPublicReviewMetrics = async (
  {
    organizationId
  }: {
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
): Promise<PublicReviewMetricsPayload> => {
  const clicks = await db.externalReviewClick.findMany({
    select: {
      link_id: true,
      provider: true
    },
    where: {
      organization_id: organizationId
    }
  });
  const providerCounts = emptyPublicReviewProviderCounts();
  const linkCounts = new Map<string, { count: number; provider: PublicReviewProviderId }>();
  let total = 0;

  clicks.forEach((click) => {
    if (!isPublicReviewProviderId(click.provider)) {
      return;
    }

    total += 1;
    providerCounts[click.provider] += 1;

    const current = linkCounts.get(click.link_id);

    linkCounts.set(click.link_id, {
      count: (current?.count ?? 0) + 1,
      provider: current?.provider ?? click.provider
    });
  });

  return {
    links: Array.from(linkCounts.entries())
      .map(([linkId, item]) => ({
        count: item.count,
        linkId,
        provider: item.provider
      }))
      .sort(
        (first, second) => second.count - first.count || first.linkId.localeCompare(second.linkId)
      ),
    organizationId,
    providers: PUBLIC_REVIEW_PROVIDER_IDS.map((provider) => ({
      count: providerCounts[provider],
      provider
    })),
    total
  };
};
