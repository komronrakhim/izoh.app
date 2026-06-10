import type { GuestEntryChannel } from "~/shared/guest-entry";

export const createUploadOwnerId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `submission-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createPhotoDraftId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getCommentRequired = ({
  channel,
  rating
}: {
  channel: GuestEntryChannel | undefined;
  rating: number;
}) => {
  if (!channel) return false;

  if (channel.id === "suggestion") {
    return true;
  }

  if (channel.id === "complaint") {
    return channel.settings.commentRequired;
  }

  return (
    channel.settings.commentRequired ||
    (channel.settings.lowRatingCommentEnabled && rating <= channel.settings.lowRatingThreshold)
  );
};

export const getContactEnabled = ({
  channel,
  rating
}: {
  channel: GuestEntryChannel | undefined;
  rating: number;
}) => {
  if (!channel) return false;

  if (channel.id === "review") {
    return (
      channel.settings.lowRatingCommentEnabled &&
      channel.settings.contactEnabled &&
      rating <= channel.settings.lowRatingThreshold
    );
  }

  return channel.settings.contactEnabled;
};

export const getContactRequired = ({
  channel,
  rating
}: {
  channel: GuestEntryChannel | undefined;
  rating: number;
}) => {
  if (!channel) return false;

  if (channel.id === "review") {
    return false;
  }

  return channel.settings.contactEnabled && channel.settings.contactRequired;
};
