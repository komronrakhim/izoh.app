import type { ComponentType, RefObject } from "react";
import type { TOptions } from "i18next";

import type { GuestEntryChannelId } from "~/shared/guest-entry";

export type CustomerWizardTranslate = (key: string, options?: TOptions) => string;

export type WizardStep =
  | "choice"
  | "rating"
  | "details"
  | "message"
  | "contact"
  | "summary"
  | "done";

export type WizardRouteStep = Exclude<WizardStep, "choice">;

export type WizardChoiceId = "great" | "ok" | "issue" | "idea";

export type WizardChoice = {
  channelId: GuestEntryChannelId;
  emoji: string;
  id: WizardChoiceId;
  rating?: number;
  tone: string;
};

export type StaffTargetType = "team" | "employee" | "unknown";

export type StaffTarget = {
  avatarUrl?: null | string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  id: string;
  subtitle: string;
  targetType: StaffTargetType;
  title: string;
  tone: string;
};

export type TopicOption = {
  emoji: string;
  id: string;
  title: string;
};

export type SubmissionPhotoDraft = {
  clientId: string;
  error?: string;
  fileName: string;
  mediaAssetId?: string;
  previewUrl: string;
  status: "failed" | "ready" | "uploading";
};

export type PhotoInputRef = RefObject<HTMLInputElement | null>;

export type MediaUploadSessionResponse = {
  headers: Record<string, string>;
  maxBytes: number;
  method: "PUT";
  session: {
    id: string;
  };
  uploadUrl: string;
};

export type FinalizedMediaAsset = {
  id: string;
  kind: "ORGANIZATION_LOGO" | "STAFF_AVATAR" | "SUBMISSION_PHOTO" | "SUBMISSION_THUMBNAIL";
  public_url: string;
};

export type MediaFinalizeResponse = {
  assets: FinalizedMediaAsset[];
};
