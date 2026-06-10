import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserRound, UsersRound } from "lucide-react";
import * as React from "react";

import { fetchApiJson } from "~/shared/api";
import {
  type GuestEntryChannel,
  type GuestEntryChannelId,
  type GuestEntryConfigPayload
} from "~/shared/guest-entry";
import { toPrismaLocale } from "~/shared/i18n";
import { useI18n } from "~/shared/i18n/react";
import {
  COMPLAINT_CATEGORY_IDS,
  SUGGESTION_TOPIC_IDS,
  type ComplaintCategoryId,
  type SuggestionTopicId
} from "~/shared/module-settings";
import { queryKeys } from "~/shared/query";
import { SUBMISSION_PHOTO_LIMIT, SUBMISSION_PHOTO_MAX_BYTES } from "~/shared/submissions";
import { hideTmaMainButtonNow, type TmaButtonState, useTma } from "~/shared/tma";

import {
  choiceAccentColors,
  choiceToneClassNames,
  getTopicEmoji,
  ratingOptions,
  supportedPhotoContentTypes,
  TEAM_STAFF_TARGET_ID,
  UNKNOWN_STAFF_TARGET_ID
} from "../constants";
import {
  getCommentRequiredText,
  getComplaintDetailRequiredText,
  getComplaintOptionalText
} from "../copy";
import type {
  MediaFinalizeResponse,
  MediaUploadSessionResponse,
  StaffTarget,
  SubmissionPhotoDraft,
  TopicOption,
  WizardChoice,
  WizardChoiceId,
  WizardRouteStep,
  WizardStep
} from "../types";
import {
  createPhotoDraftId,
  createUploadOwnerId,
  getCommentRequired,
  getContactEnabled,
  getContactRequired
} from "../utils";

type NavigateStepOptions = {
  replace?: boolean;
};

type CustomerWizardContextValue = {
  activeChannel?: GuestEntryChannel;
  bodyText: string;
  canGoBack: (step: WizardRouteStep) => boolean;
  choose: (choice: WizardChoice) => void;
  choices: WizardChoice[];
  contact: string;
  contactEnabled: boolean;
  contactRequired: boolean;
  currentAccent: string;
  currentStepIsValid: (step: WizardRouteStep) => boolean;
  getMainButtonState: (step: WizardRouteStep) => TmaButtonState | null;
  getStepContentKey: (step: WizardRouteStep | "choice") => string;
  getStepSubtitle: (step: WizardRouteStep | "choice") => string;
  getStepTitle: (step: WizardRouteStep | "choice") => string;
  goBack: (step: WizardRouteStep) => void;
  goNext: (step: WizardRouteStep) => void;
  goToChoice: (options?: NavigateStepOptions) => void;
  goToStep: (step: WizardRouteStep, options?: NavigateStepOptions) => void;
  guestEntryConfig: GuestEntryConfigPayload | null;
  isError: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  isUploadingPhotos: boolean;
  messageHelperText: string;
  messageHelperTone: "danger" | "muted";
  messagePlaceholder: string;
  onBodyTextChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onPhotoFiles: (files: FileList | null) => void;
  onRatingChange: (value: number) => void;
  onRemovePhoto: (clientId: string) => void;
  onSelectStaffTarget: (id: string) => void;
  onToggleTopic: (id: string) => void;
  organizationName?: string;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  photoHint: string;
  photos: SubmissionPhotoDraft[];
  photosEnabled: boolean;
  progressMetaForStep: (step: WizardRouteStep) => {
    current: number;
    total: number;
  };
  rating: number;
  resetToChoice: () => void;
  resolveRouteStep: (step: WizardRouteStep) => WizardRouteStep | "choice";
  selectedChoice?: WizardChoice;
  selectedChoiceId: WizardChoiceId | null;
  selectedRatingEmoji: string;
  selectedRatingLabel: string;
  selectedStaffTarget?: StaffTarget;
  selectedTopicIds: string[];
  selectedTopicOptions: TopicOption[];
  showProgress: (step: WizardRouteStep) => boolean;
  showStaffTarget: boolean;
  showTopics: boolean;
  staffTargetId: string;
  staffTargets: StaffTarget[];
  summaryHint?: string;
  topicOptions: TopicOption[];
  validationAttemptedStep: WizardStep | null;
  wizardStyle: React.CSSProperties;
};

const CustomerWizardContext = React.createContext<CustomerWizardContextValue | null>(null);

const getShowStaffTarget = (targets: StaffTarget[]) =>
  targets.length > 1 || (targets.length === 1 && targets[0]?.targetType !== "team");

const getShowTopics = ({
  channel,
  topicCount
}: {
  channel: GuestEntryChannel | undefined;
  topicCount: number;
}) => (channel?.id === "complaint" ? topicCount > 0 : topicCount > 1);

const getWizardRouteSteps = ({
  channel,
  contactEnabled,
  showStaffTarget,
  showTopics
}: {
  channel: GuestEntryChannel | undefined;
  contactEnabled: boolean;
  showStaffTarget: boolean;
  showTopics: boolean;
}): WizardStep[] => {
  if (!channel) {
    return ["choice"];
  }

  return [
    "choice",
    ...(channel.id === "review" ? (["rating"] as const) : []),
    ...(showTopics || showStaffTarget ? (["details"] as const) : []),
    "message",
    ...(contactEnabled ? (["contact"] as const) : []),
    "summary"
  ];
};

export const CustomerWizardProvider = ({ children }: { children: React.ReactNode }) => {
  const { startParam } = useParams({ from: "/guest/$startParam" });
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const tma = useTma();
  const guestEntryConfigQuery = useQuery({
    queryFn: () =>
      fetchApiJson<GuestEntryConfigPayload>(`/api/guest-entry/${encodeURIComponent(startParam)}`),
    queryKey: queryKeys.guestEntryConfig(startParam)
  });
  const guestEntryConfig = guestEntryConfigQuery.data ?? null;
  const [selectedChoiceId, setSelectedChoiceId] = React.useState<WizardChoiceId | null>(null);
  const [kind, setKind] = React.useState<GuestEntryChannelId | null>(null);
  const [rating, setRating] = React.useState(5);
  const [selectedTopicIds, setSelectedTopicIds] = React.useState<string[]>([]);
  const [bodyText, setBodyText] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [staffTargetId, setStaffTargetId] = React.useState("");
  const [attachmentOwnerId, setAttachmentOwnerId] = React.useState(createUploadOwnerId);
  const [photos, setPhotos] = React.useState<SubmissionPhotoDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationAttemptedStep, setValidationAttemptedStep] = React.useState<WizardStep | null>(
    null
  );
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const photosRef = React.useRef<SubmissionPhotoDraft[]>([]);

  React.useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const resetAnswerFields = React.useCallback(() => {
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    photosRef.current = [];
    setSelectedTopicIds([]);
    setBodyText("");
    setContact("");
    setStaffTargetId("");
    setPhotos([]);
    setAttachmentOwnerId(createUploadOwnerId());
  }, []);

  React.useEffect(
    () => () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    },
    []
  );

  React.useEffect(() => {
    setKind(null);
    setSelectedChoiceId(null);
    setRating(5);
    setValidationAttemptedStep(null);
    resetAnswerFields();
  }, [resetAnswerFields, startParam]);

  const channelsById = React.useMemo(() => {
    const map = new Map<GuestEntryChannelId, GuestEntryChannel>();

    guestEntryConfig?.channels.forEach((channel) => {
      map.set(channel.id, channel);
    });

    return map;
  }, [guestEntryConfig?.channels]);

  const activeChannel = kind ? channelsById.get(kind) : undefined;

  const choices = React.useMemo<WizardChoice[]>(() => {
    const review = channelsById.get("review");
    const complaint = channelsById.get("complaint");
    const suggestion = channelsById.get("suggestion");
    const items: WizardChoice[] = [];

    if (review) {
      items.push({
        channelId: "review",
        emoji: "😍",
        id: "great",
        rating: 5,
        tone: choiceToneClassNames.great
      });
      items.push({
        channelId: "review",
        emoji: "🙂",
        id: "ok",
        rating: 3,
        tone: choiceToneClassNames.ok
      });
    }

    if (complaint) {
      items.push({
        channelId: "complaint",
        emoji: "😕",
        id: "issue",
        tone: choiceToneClassNames.issue
      });
    } else if (review) {
      items.push({
        channelId: "review",
        emoji: "😕",
        id: "issue",
        rating: 2,
        tone: choiceToneClassNames.issue
      });
    }

    if (suggestion) {
      items.push({
        channelId: "suggestion",
        emoji: "💡",
        id: "idea",
        tone: choiceToneClassNames.idea
      });
    }

    return items;
  }, [channelsById]);

  const getTopicOptionsForChannel = React.useCallback(
    (channel: GuestEntryChannel | undefined) => {
      if (!channel) {
        return [];
      }

      if (channel.id === "complaint" && channel.settings.categoriesEnabled) {
        const enabledIds = new Set(channel.settings.complaintCategoryIds);

        return COMPLAINT_CATEGORY_IDS.filter((id) => enabledIds.has(id)).map((id) => ({
          emoji: getTopicEmoji(channel.id, id),
          id,
          title: t(`customer.topicOptions.complaint.${id}`)
        }));
      }

      if (channel.id === "suggestion" && channel.settings.categoriesEnabled) {
        const enabledIds = new Set(channel.settings.suggestionTopicIds);

        return SUGGESTION_TOPIC_IDS.filter((id) => enabledIds.has(id)).map((id) => ({
          emoji: getTopicEmoji(channel.id, id),
          id,
          title: t(`customer.topicOptions.suggestion.${id}`)
        }));
      }

      return [];
    },
    [t]
  );

  const getStaffTargetsForChannel = React.useCallback(
    (channelId: GuestEntryChannelId | null | undefined): StaffTarget[] => {
      if (!guestEntryConfig?.staff.enabled || channelId === "suggestion") {
        return [];
      }

      const employeeTargets = guestEntryConfig.staff.settings.guestSelectionEnabled
        ? guestEntryConfig.staff.items.map((staffMember) => ({
            avatarUrl: staffMember.avatarUrl,
            icon: UserRound,
            id: staffMember.id,
            subtitle: staffMember.roleTitle || t("customer.staffTarget.employeeSubtitle"),
            targetType: "employee" as const,
            title: staffMember.displayName,
            tone: "bg-[#AF52DE] text-white"
          }))
        : [];

      return [
        ...(guestEntryConfig.staff.settings.allowTeamReview
          ? [
              {
                icon: UsersRound,
                id: TEAM_STAFF_TARGET_ID,
                subtitle: t("customer.staffTarget.teamSubtitle"),
                targetType: "team" as const,
                title: t("customer.staffTarget.teamTitle"),
                tone: "bg-[#007AFF] text-white"
              }
            ]
          : []),
        ...(!guestEntryConfig.staff.settings.allowTeamReview && employeeTargets.length > 0
          ? [
              {
                icon: UsersRound,
                id: UNKNOWN_STAFF_TARGET_ID,
                subtitle: t("customer.staffTarget.unknownSubtitle"),
                targetType: "unknown" as const,
                title: t("customer.staffTarget.unknownTitle"),
                tone: "bg-[#8E8E93] text-white"
              }
            ]
          : []),
        ...employeeTargets
      ];
    },
    [
      guestEntryConfig?.staff.enabled,
      guestEntryConfig?.staff.items,
      guestEntryConfig?.staff.settings,
      t
    ]
  );

  const topicOptions = React.useMemo(
    () => getTopicOptionsForChannel(activeChannel),
    [activeChannel, getTopicOptionsForChannel]
  );
  const showTopics = getShowTopics({
    channel: activeChannel,
    topicCount: topicOptions.length
  });
  const staffTargets = React.useMemo(
    () => getStaffTargetsForChannel(kind),
    [getStaffTargetsForChannel, kind]
  );
  const showStaffTarget = getShowStaffTarget(staffTargets);
  const commentRequired = getCommentRequired({
    channel: activeChannel,
    rating
  });
  const contactEnabled = getContactEnabled({
    channel: activeChannel,
    rating
  });
  const contactRequired = getContactRequired({
    channel: activeChannel,
    rating
  });
  const photosEnabled = Boolean(activeChannel?.settings.photosEnabled);
  const wizardSteps = React.useMemo(
    () =>
      getWizardRouteSteps({
        channel: activeChannel,
        contactEnabled,
        showStaffTarget,
        showTopics
      }),
    [activeChannel, contactEnabled, showStaffTarget, showTopics]
  );

  React.useEffect(() => {
    if (!showStaffTarget) {
      setStaffTargetId("");
      return;
    }

    if (!staffTargets.some((target) => target.id === staffTargetId)) {
      setStaffTargetId(staffTargets[0]?.id ?? "");
    }
  }, [showStaffTarget, staffTargetId, staffTargets]);

  React.useEffect(() => {
    setSelectedTopicIds((current) =>
      current.filter((id) => topicOptions.some((item) => item.id === id))
    );
  }, [topicOptions]);

  React.useEffect(() => {
    if (photosEnabled) return;

    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    photosRef.current = [];
    setPhotos([]);
  }, [photosEnabled]);

  React.useEffect(() => {
    if (contactEnabled) return;

    setContact("");
  }, [contactEnabled]);

  const selectedChoice = selectedChoiceId
    ? choices.find((choice) => choice.id === selectedChoiceId)
    : undefined;
  const selectedRatingEmoji =
    ratingOptions.find((option) => option.value === rating)?.emoji ?? ratingOptions[4].emoji;
  const selectedRatingLabel = t(`customer.wizard.rating.labels.${rating}`);
  const selectedStaffTarget = showStaffTarget
    ? staffTargets.find((target) => target.id === staffTargetId)
    : undefined;
  const implicitStaffTarget =
    !showStaffTarget && staffTargets.length === 1 ? staffTargets[0] : undefined;
  const submissionStaffTarget = selectedStaffTarget ?? implicitStaffTarget;
  const staffTargetType = submissionStaffTarget?.targetType ?? "none";
  const targetStaffMemberId =
    submissionStaffTarget?.targetType === "employee" ? submissionStaffTarget.id : undefined;
  const effectiveTopicIds =
    showTopics || topicOptions.length !== 1 || !topicOptions[0]
      ? selectedTopicIds
      : [topicOptions[0].id];
  const isUploadingPhotos = photos.some((photo) => photo.status === "uploading");
  const readyPhotoIds = photos
    .filter((photo) => photo.status === "ready" && photo.mediaAssetId)
    .map((photo) => photo.mediaAssetId as string);
  const hasMessageText = Boolean(bodyText.trim());
  const complaintHasAnyDetail =
    activeChannel?.id !== "complaint" ||
    hasMessageText ||
    effectiveTopicIds.length > 0 ||
    readyPhotoIds.length > 0;
  const detailsStepIsValid = !showStaffTarget || Boolean(staffTargetId);
  const messageStepIsValid =
    activeChannel?.id === "complaint"
      ? (!commentRequired || hasMessageText) && complaintHasAnyDetail
      : !commentRequired || hasMessageText;
  const contactStepIsValid = !contactRequired || Boolean(contact.trim());
  const currentAccent =
    selectedChoiceId && selectedChoiceId in choiceAccentColors
      ? choiceAccentColors[selectedChoiceId]
      : "var(--iz-color-primary)";
  const mainButtonColor = currentAccent.startsWith("#")
    ? (currentAccent as `#${string}`)
    : tma.primaryColor;
  const wizardStyle = {
    "--wizard-accent": currentAccent
  } as React.CSSProperties;
  const selectedTopicOptions = topicOptions.filter((topic) => effectiveTopicIds.includes(topic.id));
  const reviewStaffCopyKey =
    activeChannel?.id === "review" ? `customer.wizard.staff.review.${rating}` : null;
  const reviewCommentCopyKey =
    activeChannel?.id === "review" ? `customer.wizard.comment.reviewByRating.${rating}` : null;
  const doneCopyKey =
    activeChannel?.id === "review"
      ? `customer.wizard.done.reviewByRating.${rating}`
      : activeChannel?.id
        ? `customer.wizard.done.${activeChannel.id}`
        : "customer.wizard.done.default";
  const messagePlaceholder = t(
    reviewCommentCopyKey
      ? `${reviewCommentCopyKey}.placeholder`
      : activeChannel
        ? `customer.placeholders.${activeChannel.id}`
        : "customer.placeholders.review"
  );
  const optionalCommentHint =
    activeChannel?.id === "complaint"
      ? getComplaintOptionalText({
          photosEnabled,
          showTopics,
          t
        })
      : t(
          reviewCommentCopyKey
            ? `${reviewCommentCopyKey}.optional`
            : `customer.wizard.comment.optional.${activeChannel?.id ?? "review"}`
        );
  const messageHelperText =
    activeChannel?.id === "complaint" && !commentRequired && !complaintHasAnyDetail
      ? getComplaintDetailRequiredText({
          photosEnabled,
          showTopics,
          t
        })
      : commentRequired && !hasMessageText
        ? getCommentRequiredText({
            channel: activeChannel,
            rating,
            t
          })
        : hasMessageText && activeChannel
          ? t(`customer.wizard.comment.filled.${activeChannel.id}`)
          : optionalCommentHint;
  const messageHelperTone =
    validationAttemptedStep === "message" && !messageStepIsValid ? "danger" : "muted";
  const summaryHint = contactEnabled
    ? t(
        contact.trim()
          ? "customer.wizard.summary.contactPrivateHint"
          : "customer.wizard.summary.contactOptionalHint"
      )
    : undefined;
  const photoHint = activeChannel
    ? t(`customer.photos.hints.${activeChannel.id}`)
    : t("customer.photos.hints.review");

  const goToChoice = React.useCallback(
    (options: NavigateStepOptions = {}) => {
      hideTmaMainButtonNow();
      void navigate({
        params: {
          startParam
        },
        replace: options.replace,
        to: "/guest/$startParam"
      });
    },
    [navigate, startParam]
  );

  const goToStep = React.useCallback(
    (step: WizardRouteStep, options: NavigateStepOptions = {}) => {
      void navigate({
        params: {
          startParam,
          wizardStep: step
        },
        replace: options.replace,
        to: "/guest/$startParam/$wizardStep"
      });
    },
    [navigate, startParam]
  );

  const resetToChoice = React.useCallback(() => {
    hideTmaMainButtonNow();
    setKind(null);
    setSelectedChoiceId(null);
    setRating(5);
    setValidationAttemptedStep(null);
    resetAnswerFields();
  }, [resetAnswerFields]);

  const getStepsForChoice = React.useCallback(
    (choice: WizardChoice) => {
      const channel = channelsById.get(choice.channelId);
      const nextRating = choice.rating ?? 5;
      const nextTopicOptions = getTopicOptionsForChannel(channel);
      const nextShowTopics = getShowTopics({
        channel,
        topicCount: nextTopicOptions.length
      });
      const nextStaffTargets = getStaffTargetsForChannel(choice.channelId);
      const nextShowStaffTarget = getShowStaffTarget(nextStaffTargets);
      const nextContactEnabled = getContactEnabled({
        channel,
        rating: nextRating
      });

      return getWizardRouteSteps({
        channel,
        contactEnabled: nextContactEnabled,
        showStaffTarget: nextShowStaffTarget,
        showTopics: nextShowTopics
      });
    },
    [channelsById, getStaffTargetsForChannel, getTopicOptionsForChannel]
  );

  const choose = React.useCallback(
    (choice: WizardChoice) => {
      const nextSteps = getStepsForChoice(choice);
      const nextStep = nextSteps.find((item) => item !== "choice") as WizardRouteStep | undefined;

      setSelectedChoiceId(choice.id);
      setKind(choice.channelId);
      setRating(choice.rating ?? 5);
      resetAnswerFields();
      setValidationAttemptedStep(null);
      tma.haptics.selection();

      if (nextStep) {
        goToStep(nextStep);
      }
    },
    [getStepsForChoice, goToStep, resetAnswerFields, tma.haptics]
  );

  const progressMetaForStep = React.useCallback(
    (step: WizardRouteStep) => {
      const visibleSteps = wizardSteps.filter(
        (item): item is WizardRouteStep => item !== "choice" && item !== "done"
      );
      const currentIndex = Math.max(0, visibleSteps.indexOf(step));

      return {
        current: currentIndex + 1,
        total: visibleSteps.length
      };
    },
    [wizardSteps]
  );

  const currentStepIsValid = React.useCallback(
    (step: WizardRouteStep) =>
      step === "details"
        ? detailsStepIsValid
        : step === "message"
          ? messageStepIsValid && !isUploadingPhotos
          : step === "contact"
            ? contactStepIsValid
            : true,
    [contactStepIsValid, detailsStepIsValid, isUploadingPhotos, messageStepIsValid]
  );

  const showProgress = React.useCallback(
    (step: WizardRouteStep) => Boolean(guestEntryConfig && choices.length > 0 && step !== "done"),
    [choices.length, guestEntryConfig]
  );

  const canGoBack = React.useCallback((step: WizardRouteStep) => step !== "done", []);

  const resolveRouteStep = React.useCallback(
    (step: WizardRouteStep) => {
      if (!activeChannel || choices.length === 0) {
        return "choice";
      }

      if (step === "done") {
        return selectedChoiceId ? "done" : "choice";
      }

      if (wizardSteps.includes(step)) {
        return step;
      }

      if (step === "contact" && wizardSteps.includes("summary")) {
        return "summary";
      }

      return (
        (wizardSteps.find((item) => item !== "choice") as WizardRouteStep | undefined) ?? "choice"
      );
    },
    [activeChannel, choices.length, selectedChoiceId, wizardSteps]
  );

  const getStepTitle = React.useCallback(
    (step: WizardRouteStep | "choice") => {
      if (step === "choice") {
        return t("customer.wizard.choice.title");
      }

      if (step === "rating") {
        return t("customer.wizard.rating.title");
      }

      if (step === "details") {
        if (showTopics && showStaffTarget) {
          return t("customer.wizard.details.title");
        }

        if (showTopics) {
          return t(`customer.wizard.topics.${activeChannel?.id}.title`);
        }

        return t(
          reviewStaffCopyKey ? `${reviewStaffCopyKey}.title` : "customer.wizard.staff.title"
        );
      }

      if (step === "message") {
        return t(
          reviewCommentCopyKey
            ? `${reviewCommentCopyKey}.title`
            : `customer.wizard.comment.${activeChannel?.id}.title`
        );
      }

      if (step === "contact") {
        return t(
          contactRequired
            ? "customer.wizard.contact.titleRequired"
            : "customer.wizard.contact.titleOptional"
        );
      }

      if (step === "summary") {
        return t("customer.wizard.summary.title");
      }

      return t(`${doneCopyKey}.title`);
    },
    [
      activeChannel?.id,
      doneCopyKey,
      reviewCommentCopyKey,
      reviewStaffCopyKey,
      showStaffTarget,
      showTopics,
      t,
      contactRequired
    ]
  );

  const getStepSubtitle = React.useCallback(
    (step: WizardRouteStep | "choice") => {
      if (step === "choice") {
        return t("customer.wizard.choice.subtitle");
      }

      if (step === "rating") {
        return t("customer.wizard.rating.subtitle");
      }

      if (step === "details") {
        if (showTopics && showStaffTarget) {
          return t("customer.wizard.details.subtitle");
        }

        if (showTopics) {
          return t(`customer.wizard.topics.${activeChannel?.id}.subtitle`);
        }

        return t(
          reviewStaffCopyKey ? `${reviewStaffCopyKey}.subtitle` : "customer.wizard.staff.subtitle"
        );
      }

      if (step === "message") {
        return t(
          reviewCommentCopyKey
            ? `${reviewCommentCopyKey}.subtitle`
            : `customer.wizard.comment.${activeChannel?.id}.subtitle`
        );
      }

      if (step === "contact") {
        return t(
          contactRequired
            ? "customer.wizard.contact.subtitleRequired"
            : "customer.wizard.contact.subtitleOptional"
        );
      }

      if (step === "summary") {
        return t("customer.wizard.summary.subtitle");
      }

      return t(`${doneCopyKey}.subtitle`);
    },
    [
      activeChannel?.id,
      doneCopyKey,
      reviewCommentCopyKey,
      reviewStaffCopyKey,
      showStaffTarget,
      showTopics,
      t,
      contactRequired
    ]
  );

  const getMainButtonState = React.useCallback(
    (step: WizardRouteStep): TmaButtonState | null => {
      if (!guestEntryConfig || choices.length === 0 || step === "done") {
        return null;
      }

      const primaryActionDisabled = isSubmitting || (step === "message" && isUploadingPhotos);

      return {
        color: mainButtonColor,
        enabled: !primaryActionDisabled,
        loading: isSubmitting,
        shine: currentStepIsValid(step) && !primaryActionDisabled,
        text: step === "summary" ? t("customer.submit") : t("customer.next"),
        textColor: "#FFFFFF"
      };
    },
    [
      choices.length,
      currentStepIsValid,
      guestEntryConfig,
      isSubmitting,
      isUploadingPhotos,
      mainButtonColor,
      t
    ]
  );

  const getStepContentKey = React.useCallback(
    (step: WizardRouteStep | "choice") => `${step}:${kind ?? "none"}`,
    [kind]
  );

  const toggleTopic = React.useCallback(
    (id: string) => {
      setSelectedTopicIds((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      );
      tma.haptics.selection();
    },
    [tma.haptics]
  );

  const removePhoto = React.useCallback(
    (clientId: string) => {
      setPhotos((current) => {
        const removedPhoto = current.find((photo) => photo.clientId === clientId);

        if (removedPhoto) {
          URL.revokeObjectURL(removedPhoto.previewUrl);
        }

        return current.filter((photo) => photo.clientId !== clientId);
      });
      tma.haptics.selection();
    },
    [tma.haptics]
  );

  const uploadPhoto = React.useCallback(
    async (file: File) => {
      if (!guestEntryConfig) return;

      const clientId = createPhotoDraftId();
      const previewUrl = URL.createObjectURL(file);
      const fail = (error: string) => {
        setPhotos((current) =>
          current.map((photo) =>
            photo.clientId === clientId
              ? {
                  ...photo,
                  error,
                  status: "failed"
                }
              : photo
          )
        );
        tma.haptics.notification("error");
      };

      setPhotos((current) => [
        ...current,
        {
          clientId,
          fileName: file.name,
          previewUrl,
          status: "uploading"
        }
      ]);

      if (!supportedPhotoContentTypes.includes(file.type)) {
        fail(t("customer.photos.errors.type"));
        return;
      }

      if (file.size > SUBMISSION_PHOTO_MAX_BYTES) {
        fail(t("customer.photos.errors.size"));
        return;
      }

      try {
        const sessionResponse = await fetch("/api/media/upload-sessions", {
          body: JSON.stringify({
            contentType: file.type,
            fileName: file.name,
            kind: "SUBMISSION_PHOTO",
            ownerId: attachmentOwnerId,
            ownerType: "SUBMISSION"
          }),
          headers: {
            "Content-Type": "application/json",
            ...(tma.initDataRaw ? { "X-Telegram-Init-Data": tma.initDataRaw } : {})
          },
          method: "POST"
        });

        if (!sessionResponse.ok) {
          throw new Error("Upload session failed.");
        }

        const uploadSession = (await sessionResponse.json()) as MediaUploadSessionResponse;

        if (file.size > uploadSession.maxBytes) {
          throw new Error("File is too large.");
        }

        const uploadResponse = await fetch(uploadSession.uploadUrl, {
          body: file,
          headers: uploadSession.headers,
          method: uploadSession.method
        });

        if (!uploadResponse.ok) {
          throw new Error("Direct upload failed.");
        }

        const finalizeResponse = await fetch(
          `/api/media/upload-sessions/${uploadSession.session.id}/finalize`,
          {
            headers: {
              ...(tma.initDataRaw ? { "X-Telegram-Init-Data": tma.initDataRaw } : {})
            },
            method: "POST"
          }
        );

        if (!finalizeResponse.ok) {
          throw new Error("Upload finalization failed.");
        }

        const finalized = (await finalizeResponse.json()) as MediaFinalizeResponse;
        const photoAsset = finalized.assets.find((asset) => asset.kind === "SUBMISSION_PHOTO");

        if (!photoAsset) {
          throw new Error("Processed photo was not returned.");
        }

        setPhotos((current) =>
          current.map((photo) =>
            photo.clientId === clientId
              ? {
                  ...photo,
                  mediaAssetId: photoAsset.id,
                  status: "ready"
                }
              : photo
          )
        );
        tma.haptics.notification("success");
      } catch {
        fail(t("customer.photos.errors.upload"));
      }
    },
    [attachmentOwnerId, guestEntryConfig, t, tma.haptics, tma.initDataRaw]
  );

  const handlePhotoFiles = React.useCallback(
    (files: FileList | null) => {
      if (!files || !photosEnabled) return;

      const freeSlots = SUBMISSION_PHOTO_LIMIT - photos.length;
      const selectedFiles = Array.from(files).slice(0, Math.max(0, freeSlots));

      if (selectedFiles.length === 0) {
        tma.haptics.notification("error");
        return;
      }

      selectedFiles.forEach((file) => {
        void uploadPhoto(file);
      });
    },
    [photos.length, photosEnabled, tma.haptics, uploadPhoto]
  );

  const submit = React.useCallback(() => {
    if (
      !guestEntryConfig ||
      !activeChannel ||
      isSubmitting ||
      isUploadingPhotos ||
      !detailsStepIsValid ||
      !messageStepIsValid ||
      !contactStepIsValid
    ) {
      tma.haptics.notification("error");
      return;
    }

    const staffMetadata =
      staffTargetType === "none"
        ? {}
        : {
            staffTargetType
          };
    const metadata =
      activeChannel.id === "complaint"
        ? {
            complaintCategoryIds: effectiveTopicIds as ComplaintCategoryId[],
            ...staffMetadata,
            wizardChoiceId: selectedChoiceId
          }
        : activeChannel.id === "suggestion"
          ? {
              suggestionTopicIds: effectiveTopicIds as SuggestionTopicId[],
              wizardChoiceId: selectedChoiceId
            }
          : {
              ...staffMetadata,
              wizardChoiceId: selectedChoiceId
            };
    const normalizedContact = contactEnabled ? contact.trim() : "";

    setIsSubmitting(true);

    void (async () => {
      try {
        const response = await fetch("/api/submissions", {
          body: JSON.stringify({
            bodyText: bodyText.trim(),
            customerAllowsReply: Boolean(normalizedContact),
            customerContactPhone: normalizedContact || undefined,
            attachmentMediaAssetIds: readyPhotoIds,
            attachmentOwnerId,
            kind: activeChannel.module,
            locale: toPrismaLocale(locale),
            metadata,
            organizationId: guestEntryConfig.organization.id,
            rating: activeChannel.id === "review" ? rating : undefined,
            startParam: guestEntryConfig.startParam,
            targetStaffMemberId
          }),
          headers: {
            "Content-Type": "application/json",
            ...(tma.initDataRaw ? { "X-Telegram-Init-Data": tma.initDataRaw } : {})
          },
          method: "POST"
        });

        if (!response.ok) {
          throw new Error("Submission failed.");
        }

        hideTmaMainButtonNow();
        setIsSubmitting(false);
        goToStep("done", {
          replace: true
        });
        tma.haptics.notification("success");
      } catch {
        setIsSubmitting(false);
        tma.haptics.notification("error");
      }
    })();
  }, [
    activeChannel,
    attachmentOwnerId,
    bodyText,
    contact,
    contactEnabled,
    contactStepIsValid,
    detailsStepIsValid,
    effectiveTopicIds,
    goToStep,
    guestEntryConfig,
    isSubmitting,
    isUploadingPhotos,
    locale,
    messageStepIsValid,
    rating,
    readyPhotoIds,
    selectedChoiceId,
    staffTargetType,
    targetStaffMemberId,
    tma.haptics,
    tma.initDataRaw
  ]);

  const goNext = React.useCallback(
    (step: WizardRouteStep) => {
      if (!currentStepIsValid(step)) {
        setValidationAttemptedStep(step);
        tma.haptics.notification("error");
        return;
      }

      const currentStepIndex = wizardSteps.indexOf(step);
      const nextStep = wizardSteps[currentStepIndex + 1] as WizardRouteStep | undefined;

      if (!nextStep) {
        submit();
        return;
      }

      setValidationAttemptedStep(null);
      goToStep(nextStep);
      tma.haptics.selection();
    },
    [currentStepIsValid, goToStep, submit, tma.haptics, wizardSteps]
  );

  const goBack = React.useCallback(
    (step: WizardRouteStep) => {
      const index = wizardSteps.indexOf(step);
      const previousStep = wizardSteps[index - 1];
      setValidationAttemptedStep(null);

      if (!previousStep || previousStep === "choice") {
        resetToChoice();
        goToChoice();
        return;
      }

      goToStep(previousStep as WizardRouteStep);
    },
    [goToChoice, goToStep, resetToChoice, wizardSteps]
  );

  const value = React.useMemo<CustomerWizardContextValue>(
    () => ({
      activeChannel,
      bodyText,
      canGoBack,
      choose,
      choices,
      contact,
      contactEnabled,
      contactRequired,
      currentAccent,
      currentStepIsValid,
      getMainButtonState,
      getStepContentKey,
      getStepSubtitle,
      getStepTitle,
      goBack,
      goNext,
      goToChoice,
      goToStep,
      guestEntryConfig,
      isError: guestEntryConfigQuery.isError,
      isLoading: guestEntryConfigQuery.isLoading,
      isSubmitting,
      isUploadingPhotos,
      messageHelperText,
      messageHelperTone,
      messagePlaceholder,
      onBodyTextChange: setBodyText,
      onContactChange: setContact,
      onPhotoFiles: handlePhotoFiles,
      onRatingChange: (value) => {
        setRating(value);
        if (value === rating) {
          tma.haptics.selection();
          return;
        }

        tma.haptics.impact("light");
      },
      onRemovePhoto: removePhoto,
      onSelectStaffTarget: (id) => {
        setStaffTargetId(id);
        tma.haptics.selection();
      },
      onToggleTopic: toggleTopic,
      organizationName: guestEntryConfig?.organization.name,
      photoInputRef,
      photoHint,
      photos,
      photosEnabled,
      progressMetaForStep,
      rating,
      resetToChoice,
      resolveRouteStep,
      selectedChoice,
      selectedChoiceId,
      selectedRatingEmoji,
      selectedRatingLabel,
      selectedStaffTarget,
      selectedTopicIds,
      selectedTopicOptions,
      showProgress,
      showStaffTarget,
      showTopics,
      staffTargetId,
      staffTargets,
      summaryHint,
      topicOptions,
      validationAttemptedStep,
      wizardStyle
    }),
    [
      activeChannel,
      bodyText,
      canGoBack,
      choose,
      choices,
      contact,
      contactEnabled,
      contactRequired,
      currentAccent,
      currentStepIsValid,
      getMainButtonState,
      getStepContentKey,
      getStepSubtitle,
      getStepTitle,
      goBack,
      goNext,
      goToChoice,
      goToStep,
      guestEntryConfig,
      guestEntryConfigQuery.isError,
      guestEntryConfigQuery.isLoading,
      handlePhotoFiles,
      isSubmitting,
      isUploadingPhotos,
      messageHelperText,
      messageHelperTone,
      messagePlaceholder,
      photos,
      photoHint,
      photosEnabled,
      progressMetaForStep,
      rating,
      removePhoto,
      resetToChoice,
      resolveRouteStep,
      selectedChoice,
      selectedChoiceId,
      selectedRatingEmoji,
      selectedRatingLabel,
      selectedStaffTarget,
      selectedTopicIds,
      selectedTopicOptions,
      showProgress,
      showStaffTarget,
      showTopics,
      staffTargetId,
      staffTargets,
      summaryHint,
      tma.haptics,
      toggleTopic,
      topicOptions,
      validationAttemptedStep,
      wizardStyle
    ]
  );

  return <CustomerWizardContext.Provider value={value}>{children}</CustomerWizardContext.Provider>;
};

export const useCustomerWizard = () => {
  const context = React.useContext(CustomerWizardContext);

  if (!context) {
    throw new Error("useCustomerWizard must be used inside CustomerWizardProvider.");
  }

  return context;
};
