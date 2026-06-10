import type { GuestEntryChannel } from "~/shared/guest-entry";

import type { CustomerWizardTranslate } from "../types";

export const getComplaintDetailRequiredText = ({
  photosEnabled,
  showTopics,
  t
}: {
  photosEnabled: boolean;
  showTopics: boolean;
  t: CustomerWizardTranslate;
}) => {
  if (showTopics && photosEnabled) {
    return t("customer.wizard.comment.detailRequired.complaintTextTopicPhoto");
  }

  if (showTopics) {
    return t("customer.wizard.comment.detailRequired.complaintTextTopic");
  }

  if (photosEnabled) {
    return t("customer.wizard.comment.detailRequired.complaintTextPhoto");
  }

  return t("customer.wizard.comment.detailRequired.complaintText");
};

export const getComplaintOptionalText = ({
  photosEnabled,
  showTopics,
  t
}: {
  photosEnabled: boolean;
  showTopics: boolean;
  t: CustomerWizardTranslate;
}) => {
  if (showTopics && photosEnabled) {
    return t("customer.wizard.comment.optional.complaintTopicPhoto");
  }

  if (showTopics) {
    return t("customer.wizard.comment.optional.complaintTopic");
  }

  if (photosEnabled) {
    return t("customer.wizard.comment.optional.complaintPhoto");
  }

  return t("customer.wizard.comment.optional.complaint");
};

export const getCommentRequiredText = ({
  channel,
  rating,
  t
}: {
  channel: GuestEntryChannel | undefined;
  rating: number;
  t: CustomerWizardTranslate;
}) => {
  if (channel?.id === "suggestion") {
    return t("customer.wizard.comment.required.suggestion");
  }

  if (channel?.id === "complaint") {
    return t("customer.wizard.comment.required.complaint");
  }

  if (
    channel?.id === "review" &&
    channel.settings.lowRatingCommentEnabled &&
    rating <= channel.settings.lowRatingThreshold
  ) {
    return t("customer.wizard.comment.required.reviewLow");
  }

  return t("customer.wizard.comment.required.review");
};
