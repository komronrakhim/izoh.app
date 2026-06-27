import { Check, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import * as React from "react";

import { BottomSheet, ListIcon } from "~/common/ui";
import type { PublicReviewLink } from "~/shared/module-settings";
import {
  PUBLIC_REVIEW_PROVIDER_LABELS,
  PUBLIC_REVIEW_PROVIDER_LOGOS,
  isBrandedPublicReviewProviderId
} from "~/shared/public-reviews/logos";
import { tmaHaptics } from "~/shared/tma";

import { doneTransition } from "../../constants";
import { WizardPoweredBy } from "../wizard-powered-by";

type WizardDoneStepProps = {
  isPublicReviewOpening?: boolean;
  onPublicReviewLinkClick?: (link: PublicReviewLink) => void;
  poweredByLabel: string;
  publicReviewCloseLabel: string;
  publicReviewCtaLabel: string;
  publicReviewSheetTitle: string;
  publicReviewLinks?: PublicReviewLink[];
  subtitle: string;
  title: string;
};

export const WizardDoneStep = ({
  isPublicReviewOpening,
  onPublicReviewLinkClick,
  poweredByLabel,
  publicReviewCloseLabel,
  publicReviewCtaLabel,
  publicReviewSheetTitle,
  publicReviewLinks = [],
  subtitle,
  title
}: WizardDoneStepProps) => {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const showPublicReviewCta = publicReviewLinks.length > 0 && Boolean(onPublicReviewLinkClick);
  const handlePublicReviewCtaClick = React.useCallback(() => {
    tmaHaptics.impact("light");

    if (publicReviewLinks.length === 1) {
      onPublicReviewLinkClick?.(publicReviewLinks[0]);
      return;
    }

    setSheetOpen(true);
  }, [onPublicReviewLinkClick, publicReviewLinks]);

  return (
    <>
      <section className="grid flex-1 place-items-center text-center">
        <div className="grid justify-items-center gap-5">
          <motion.span
            className="grid size-20 place-items-center rounded-full bg-success text-white shadow-[0_18px_44px_rgba(52,199,89,0.22)]"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={doneTransition.icon}
          >
            <Check size={32} strokeWidth={2.7} />
          </motion.span>
          <motion.div
            className="grid max-w-[330px] gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={doneTransition.text}
          >
            <h1 className="ios-large-title font-semibold text-foreground">{title}</h1>
            <p className="ios-body text-muted">{subtitle}</p>

            {showPublicReviewCta ? (
              <motion.button
                className="ios-body mt-3 min-h-12 w-full max-w-[300px] justify-self-center rounded-full bg-success px-5 font-semibold text-white shadow-[0_10px_24px_rgba(52,199,89,0.18)] transition-[background-color,box-shadow,opacity] active:bg-success/90 dark:shadow-[0_10px_24px_rgba(48,209,88,0.14)]"
                type="button"
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.12 }}
                onClick={handlePublicReviewCtaClick}
              >
                {publicReviewCtaLabel}
              </motion.button>
            ) : null}
          </motion.div>
        </div>
      </section>

      {showPublicReviewCta && publicReviewLinks.length > 1 ? (
        <BottomSheet
          closeLabel={publicReviewCloseLabel}
          open={sheetOpen}
          title={publicReviewSheetTitle}
          onOpenChange={setSheetOpen}
        >
          <div className="grid grid-cols-3 gap-4">
            {publicReviewLinks.map((link) => {
              const brandedProvider = isBrandedPublicReviewProviderId(link.provider)
                ? link.provider
                : null;
              const Logo = brandedProvider ? PUBLIC_REVIEW_PROVIDER_LOGOS[brandedProvider] : null;
              const label = brandedProvider
                ? PUBLIC_REVIEW_PROVIDER_LABELS[brandedProvider]
                : link.label;

              return (
                <button
                  key={link.id}
                  className="grid min-w-0 justify-items-center gap-2.5 rounded-[26px] px-1.5 py-2.5 text-center transition-colors active:bg-foreground/[0.055] disabled:opacity-45"
                  disabled={isPublicReviewOpening}
                  type="button"
                  onClick={() => {
                    tmaHaptics.impact("light");
                    setSheetOpen(false);
                    onPublicReviewLinkClick?.(link);
                  }}
                >
                  <ListIcon className="size-[72px] rounded-[22px] bg-white text-foreground ring-1 ring-black/[0.04] [&>svg]:size-11">
                    {Logo ? (
                      <Logo className="size-11" />
                    ) : (
                      <ExternalLink size={34} strokeWidth={2.15} />
                    )}
                  </ListIcon>
                  <span className="ios-footnote min-w-0 max-w-full truncate font-medium text-foreground">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      ) : null}

      <WizardPoweredBy label={poweredByLabel} />
    </>
  );
};
