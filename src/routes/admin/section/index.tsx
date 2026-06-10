import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BellRing,
  Check,
  Clock3,
  CreditCard,
  EyeOff,
  ImagePlus,
  Lightbulb,
  MessageCircleWarning,
  MessageSquareText,
  Minus,
  Phone,
  Plus,
  QrCode,
  Send,
  Sparkles,
  Star,
  Store,
  Tags,
  TriangleAlert,
  UserRound,
  UsersRound
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";

import { Avatar } from "~/common/components";
import { List, ListIcon, PendingScreen, Toggle } from "~/common/ui";
import { fetchApiJson } from "~/shared/api";
import { useAdminOrganization } from "~/shared/admin";
import {
  GUEST_MENU_MODULE_BY_ID,
  getDefaultGuestMenuItems,
  isGuestMenuItemId,
  type GuestMenuItem
} from "~/shared/guest-menu";
import { useI18n } from "~/shared/i18n/react";
import {
  COMPLAINT_CATEGORY_IDS,
  SUGGESTION_TOPIC_IDS,
  getDefaultModuleSettings,
  type ComplaintCategoryId,
  type ComplaintModuleSettings,
  type ReviewModuleSettings,
  type StaffModuleSettings,
  type SuggestionModuleSettings,
  type SuggestionTopicId
} from "~/shared/module-settings";
import {
  getDefaultNotificationSettings,
  type NotificationSettingsPatch,
  type OrganizationNotificationMode,
  type OrganizationNotificationSettings
} from "~/shared/notifications";
import { queryKeys } from "~/shared/query";
import { PageTransition } from "~/shared/router/page-transition";
import { type StaffMemberItem, type StaffMembersPayload } from "~/shared/staff";
import { useTma, useTmaBackButton } from "~/shared/tma";

const sectionIconMap = {
  analytics: BarChart3,
  complaint: MessageCircleWarning,
  feed: MessageSquareText,
  notifications: Bell,
  qr: QrCode,
  review: Star,
  staff: UsersRound,
  suggestion: Lightbulb
} as const;

type AdminSectionKey = keyof typeof sectionIconMap;

const resolveSection = (section: string): AdminSectionKey =>
  section in sectionIconMap ? (section as AdminSectionKey) : "feed";

const notificationModes = ["ALL", "IMPORTANT_ONLY", "OFF"] as const satisfies Readonly<
  OrganizationNotificationMode[]
>;

type ModuleSettingTone =
  | "add"
  | "category"
  | "cleanliness"
  | "complaintContact"
  | "comment"
  | "contact"
  | "empty"
  | "group"
  | "important"
  | "inactive"
  | "off"
  | "other"
  | "payment"
  | "person"
  | "photo"
  | "place"
  | "quality"
  | "rating"
  | "reviewContact"
  | "send"
  | "service"
  | "staff"
  | "suggestion"
  | "suggestionContact"
  | "team"
  | "topic"
  | "wait"
  | "warning";

const fallbackRowTones = [
  "send",
  "important",
  "group",
  "person",
  "team"
] as const satisfies Readonly<ModuleSettingTone[]>;

const moduleIconClassNames: Record<ModuleSettingTone, string> = {
  add: "bg-[#34C759] text-white",
  category: "bg-[#5856D6] text-white",
  cleanliness: "bg-[#2ED573] text-white",
  complaintContact: "bg-[#30D158] text-white",
  comment: "bg-[#2AABEE] text-white",
  contact: "bg-[#FF2D55] text-white",
  empty: "bg-[#32ADE6] text-white",
  group: "bg-[#AF52DE] text-white",
  important: "bg-[#FFB000] text-white",
  inactive: "bg-[#8E7CF6] text-white",
  off: "bg-[#FF3B30] text-white",
  other: "bg-[#BF5AF2] text-white",
  payment: "bg-[#FF9500] text-white",
  person: "bg-[#0A84FF] text-white",
  photo: "bg-[#9B6DFF] text-white",
  place: "bg-[#32ADE6] text-white",
  quality: "bg-[#FF2D55] text-white",
  rating: "bg-[#FFB000] text-white",
  reviewContact: "bg-[#34C759] text-white",
  send: "bg-[#34C759] text-white",
  service: "bg-[#00C7BE] text-white",
  staff: "bg-[#9B6DFF] text-white",
  suggestion: "bg-[#34C759] text-white",
  suggestionContact: "bg-[#00C7BE] text-white",
  team: "bg-[#2AABEE] text-white",
  topic: "bg-[#5856D6] text-white",
  wait: "bg-[#FF9F0A] text-white",
  warning: "bg-[#FF3B30] text-white"
};

const ModuleSettingIcon = ({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: ModuleSettingTone;
}) => <ListIcon className={moduleIconClassNames[tone]}>{children}</ListIcon>;

const reviewLowRatingThresholdMin = 2;
const reviewLowRatingThresholdMax = 4;

const ReviewThresholdControl = ({
  decreaseLabel,
  increaseLabel,
  label,
  onChange,
  value
}: {
  decreaseLabel: string;
  increaseLabel: string;
  label: string;
  onChange: (value: number) => void;
  value: number;
}) => {
  const buttonClassName =
    "grid size-7 place-items-center rounded-full bg-foreground/[0.08] text-foreground transition-[background-color,opacity] active:bg-foreground/[0.14] disabled:opacity-35 dark:bg-white/[0.12] dark:active:bg-white/[0.18]";

  return (
    <span className="flex items-center gap-1.5">
      <button
        aria-label={decreaseLabel}
        className={buttonClassName}
        disabled={value <= reviewLowRatingThresholdMin}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onChange(Math.max(reviewLowRatingThresholdMin, value - 1));
        }}
      >
        <Minus size={14} strokeWidth={2.35} />
      </button>
      <span className="ios-subhead min-w-[72px] text-center font-medium text-muted">{label}</span>
      <button
        aria-label={increaseLabel}
        className={buttonClassName}
        disabled={value >= reviewLowRatingThresholdMax}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onChange(Math.min(reviewLowRatingThresholdMax, value + 1));
        }}
      >
        <Plus size={14} strokeWidth={2.35} />
      </button>
    </span>
  );
};

const complaintCategoryMeta = {
  cleanliness: {
    icon: Sparkles,
    tone: "cleanliness"
  },
  other: {
    icon: Tags,
    tone: "other"
  },
  payment: {
    icon: CreditCard,
    tone: "payment"
  },
  conditions: {
    icon: Store,
    tone: "place"
  },
  quality: {
    icon: MessageCircleWarning,
    tone: "quality"
  },
  service: {
    icon: UsersRound,
    tone: "service"
  },
  wait: {
    icon: Clock3,
    tone: "wait"
  }
} as const satisfies Record<
  ComplaintCategoryId,
  {
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
    tone: ModuleSettingTone;
  }
>;

const suggestionTopicMeta = {
  comfort: {
    icon: Sparkles,
    tone: "place"
  },
  events: {
    icon: Lightbulb,
    tone: "suggestion"
  },
  other: {
    icon: Tags,
    tone: "other"
  },
  price: {
    icon: CreditCard,
    tone: "payment"
  },
  product: {
    icon: Store,
    tone: "category"
  },
  service: {
    icon: UsersRound,
    tone: "service"
  },
  speed: {
    icon: Clock3,
    tone: "wait"
  }
} as const satisfies Record<
  SuggestionTopicId,
  {
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
    tone: ModuleSettingTone;
  }
>;

export const AdminSection = () => {
  const params = useParams({ from: "/admin/$organizationId/$section" });
  const navigate = useNavigate();
  const tma = useTma();
  const { t, tArray } = useI18n();
  const {
    isLoading: isOrganizationsLoading,
    organizations,
    setActiveOrganizationId
  } = useAdminOrganization();
  const organization =
    organizations.find((item) => item.id === params.organizationId) ??
    organizations.find((item) => item.slug === params.organizationId) ??
    null;
  const section = resolveSection(params.section);
  const guestMenuItemId = isGuestMenuItemId(section) ? section : null;
  const FallbackSectionIcon = sectionIconMap[section];
  const label = t(`admin.rows.${section}`);
  const rows = tArray(`admin.sections.${section}.rows`);
  const defaultGuestMenuItem = guestMenuItemId
    ? getDefaultGuestMenuItems().find((item) => item.id === guestMenuItemId)
    : null;
  const queryClient = useQueryClient();
  const [shouldAnimateModuleSettings, setShouldAnimateModuleSettings] = React.useState(false);
  const guestMenuMutationIdRef = React.useRef(0);
  const reviewMutationIdRef = React.useRef(0);
  const complaintMutationIdRef = React.useRef(0);
  const suggestionMutationIdRef = React.useRef(0);
  const staffMutationIdRef = React.useRef(0);
  const notificationMutationIdRef = React.useRef(0);
  const queriesEnabled = Boolean(organization) && tma.isReady;
  const guestMenuItemQuery = useQuery({
    enabled: Boolean(guestMenuItemId) && queriesEnabled,
    queryFn: () =>
      fetchApiJson<{ item?: GuestMenuItem }>(
        `/api/organizations/${organization!.id}/guest-menu/${guestMenuItemId}`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey:
      organization && guestMenuItemId
        ? queryKeys.guestMenuItem(organization.id, guestMenuItemId, tma.initDataRaw)
        : ["organization", "guest-menu-item", "idle"]
  });
  const reviewSettingsQuery = useQuery({
    enabled: section === "review" && queriesEnabled,
    queryFn: () =>
      fetchApiJson<{ settings?: ReviewModuleSettings }>(
        `/api/organizations/${organization!.id}/modules/review/settings`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: organization
      ? queryKeys.moduleSettings(organization.id, "review", tma.initDataRaw)
      : ["organization", "module-settings", "review", "idle"]
  });
  const complaintSettingsQuery = useQuery({
    enabled: section === "complaint" && queriesEnabled,
    queryFn: () =>
      fetchApiJson<{ settings?: ComplaintModuleSettings }>(
        `/api/organizations/${organization!.id}/modules/complaint/settings`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: organization
      ? queryKeys.moduleSettings(organization.id, "complaint", tma.initDataRaw)
      : ["organization", "module-settings", "complaint", "idle"]
  });
  const suggestionSettingsQuery = useQuery({
    enabled: section === "suggestion" && queriesEnabled,
    queryFn: () =>
      fetchApiJson<{ settings?: SuggestionModuleSettings }>(
        `/api/organizations/${organization!.id}/modules/suggestion/settings`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: organization
      ? queryKeys.moduleSettings(organization.id, "suggestion", tma.initDataRaw)
      : ["organization", "module-settings", "suggestion", "idle"]
  });
  const staffSettingsQuery = useQuery({
    enabled: section === "staff" && queriesEnabled,
    queryFn: () =>
      fetchApiJson<{ settings?: StaffModuleSettings }>(
        `/api/organizations/${organization!.id}/modules/staff/settings`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: organization
      ? queryKeys.moduleSettings(organization.id, "staff", tma.initDataRaw)
      : ["organization", "module-settings", "staff", "idle"]
  });
  const notificationSettingsQuery = useQuery({
    enabled: section === "notifications" && queriesEnabled,
    queryFn: () =>
      fetchApiJson<OrganizationNotificationSettings>(
        `/api/organizations/${organization!.id}/notifications/settings`,
        {
          initDataRaw: tma.initDataRaw
        }
      ),
    queryKey: organization
      ? queryKeys.notificationSettings(organization.id, tma.initDataRaw)
      : ["organization", "notification-settings", "idle"]
  });
  const staffMembersQuery = useQuery({
    enabled: section === "staff" && queriesEnabled,
    queryFn: () =>
      fetchApiJson<StaffMembersPayload>(`/api/organizations/${organization!.id}/staff-members`, {
        initDataRaw: tma.initDataRaw
      }),
    queryKey: organization
      ? queryKeys.staffMembers(organization.id, tma.initDataRaw)
      : ["organization", "staff-members", "idle"]
  });
  const guestMenuEnabled = guestMenuItemId
    ? (guestMenuItemQuery.data?.item?.enabled ??
      (!guestMenuItemQuery.isLoading ? (defaultGuestMenuItem?.enabled ?? true) : null))
    : true;
  const reviewSettings = reviewSettingsQuery.data?.settings ?? getDefaultModuleSettings("review");
  const complaintSettings =
    complaintSettingsQuery.data?.settings ?? getDefaultModuleSettings("complaint");
  const suggestionSettings =
    suggestionSettingsQuery.data?.settings ?? getDefaultModuleSettings("suggestion");
  const staffSettings = staffSettingsQuery.data?.settings ?? getDefaultModuleSettings("staff");
  const notificationSettings =
    notificationSettingsQuery.data ?? getDefaultNotificationSettings(params.organizationId);
  const staffMembers = staffMembersQuery.data?.items ?? [];
  const isGuestMenuLoading = Boolean(
    guestMenuItemId &&
    ((organization && guestMenuItemQuery.isLoading) || (!organization && isOrganizationsLoading))
  );
  const showModuleSettings = !guestMenuItemId || guestMenuEnabled === true;
  const isOrganizationLoading = isOrganizationsLoading && !organization;
  const backToOrganization = React.useCallback(() => {
    void navigate({
      params: { organizationId: params.organizationId },
      to: "/admin/$organizationId"
    });
  }, [navigate, params.organizationId]);

  useTmaBackButton(true, backToOrganization);

  React.useEffect(() => {
    if (organization) {
      setActiveOrganizationId(organization.id);
    }
  }, [organization, setActiveOrganizationId]);

  const cacheGuestMenuItem = (item: GuestMenuItem) => {
    if (!organization) return;

    queryClient.setQueryData<{ item?: GuestMenuItem }>(
      queryKeys.guestMenuItem(organization.id, item.id, tma.initDataRaw),
      { item }
    );
    queryClient.setQueryData<{ items?: GuestMenuItem[] }>(
      queryKeys.guestMenu(organization.id, tma.initDataRaw),
      (current) => {
        const items = current?.items ?? getDefaultGuestMenuItems();
        const hasItem = items.some((currentItem) => currentItem.id === item.id);
        const nextItems = hasItem
          ? items.map((currentItem) => (currentItem.id === item.id ? item : currentItem))
          : [...items, item];

        return {
          items: nextItems
        };
      }
    );
  };

  const cacheModuleSettings = <T,>(moduleId: string, settings: T) => {
    if (!organization) return;

    queryClient.setQueryData<{ settings?: T }>(
      queryKeys.moduleSettings(organization.id, moduleId, tma.initDataRaw),
      { settings }
    );
  };

  const updateGuestMenuEnabled = (enabled: boolean) => {
    if (!guestMenuItemId || !organization) return;

    setShouldAnimateModuleSettings(true);
    cacheGuestMenuItem({
      enabled,
      id: guestMenuItemId,
      module: GUEST_MENU_MODULE_BY_ID[guestMenuItemId]
    });

    const mutationId = (guestMenuMutationIdRef.current += 1);

    void fetchApiJson<{ item?: GuestMenuItem }>(
      `/api/organizations/${organization.id}/guest-menu/${guestMenuItemId}`,
      {
        body: JSON.stringify({ enabled }),
        headers: {
          "Content-Type": "application/json"
        },
        initDataRaw: tma.initDataRaw,
        method: "PATCH"
      }
    )
      .then((payload) => {
        if (payload.item && mutationId === guestMenuMutationIdRef.current) {
          cacheGuestMenuItem(payload.item);
        }
      })
      .catch(() => undefined);
  };

  const updateComplaintSettings = (patch: Partial<ComplaintModuleSettings>) => {
    if (!organization) return;

    cacheModuleSettings<ComplaintModuleSettings>("complaint", {
      ...complaintSettings,
      ...patch
    });

    const mutationId = (complaintMutationIdRef.current += 1);

    void fetchApiJson<{ settings?: ComplaintModuleSettings }>(
      `/api/organizations/${organization.id}/modules/complaint/settings`,
      {
        body: JSON.stringify(patch),
        headers: {
          "Content-Type": "application/json"
        },
        initDataRaw: tma.initDataRaw,
        method: "PATCH"
      }
    )
      .then((payload) => {
        if (payload.settings && mutationId === complaintMutationIdRef.current) {
          cacheModuleSettings<ComplaintModuleSettings>("complaint", payload.settings);
        }
      })
      .catch(() => undefined);
  };

  const updateSuggestionSettings = (patch: Partial<SuggestionModuleSettings>) => {
    if (!organization) return;

    cacheModuleSettings<SuggestionModuleSettings>("suggestion", {
      ...suggestionSettings,
      ...patch
    });

    const mutationId = (suggestionMutationIdRef.current += 1);

    void fetchApiJson<{ settings?: SuggestionModuleSettings }>(
      `/api/organizations/${organization.id}/modules/suggestion/settings`,
      {
        body: JSON.stringify(patch),
        headers: {
          "Content-Type": "application/json"
        },
        initDataRaw: tma.initDataRaw,
        method: "PATCH"
      }
    )
      .then((payload) => {
        if (payload.settings && mutationId === suggestionMutationIdRef.current) {
          cacheModuleSettings<SuggestionModuleSettings>("suggestion", payload.settings);
        }
      })
      .catch(() => undefined);
  };

  const updateStaffSettings = (patch: Partial<StaffModuleSettings>) => {
    if (!organization) return;

    cacheModuleSettings<StaffModuleSettings>("staff", {
      ...staffSettings,
      ...patch
    });

    const mutationId = (staffMutationIdRef.current += 1);

    void fetchApiJson<{ settings?: StaffModuleSettings }>(
      `/api/organizations/${organization.id}/modules/staff/settings`,
      {
        body: JSON.stringify(patch),
        headers: {
          "Content-Type": "application/json"
        },
        initDataRaw: tma.initDataRaw,
        method: "PATCH"
      }
    )
      .then((payload) => {
        if (payload.settings && mutationId === staffMutationIdRef.current) {
          cacheModuleSettings<StaffModuleSettings>("staff", payload.settings);
        }
      })
      .catch(() => undefined);
  };

  const updateNotificationSettings = (patch: NotificationSettingsPatch) => {
    if (!organization) return;

    queryClient.setQueryData<OrganizationNotificationSettings>(
      queryKeys.notificationSettings(organization.id, tma.initDataRaw),
      {
        ...notificationSettings,
        ...patch
      }
    );

    const mutationId = (notificationMutationIdRef.current += 1);

    void fetchApiJson<OrganizationNotificationSettings>(
      `/api/organizations/${organization.id}/notifications/settings`,
      {
        body: JSON.stringify(patch),
        headers: {
          "Content-Type": "application/json"
        },
        initDataRaw: tma.initDataRaw,
        method: "PATCH"
      }
    )
      .then((nextSettings) => {
        if (mutationId === notificationMutationIdRef.current) {
          queryClient.setQueryData<OrganizationNotificationSettings>(
            queryKeys.notificationSettings(organization.id, tma.initDataRaw),
            nextSettings
          );
        }
      })
      .catch(() => undefined);
  };

  const updateStaffTargetSettings = (patch: Partial<StaffModuleSettings>) => {
    const nextSettings = {
      ...staffSettings,
      ...patch
    };

    if (!nextSettings.guestSelectionEnabled && !nextSettings.allowTeamReview) {
      return;
    }

    updateStaffSettings(patch);
  };

  const updateComplaintCategory = (categoryId: ComplaintCategoryId, enabled: boolean) => {
    const currentCategoryIds = complaintSettings.complaintCategoryIds;

    if (!enabled && currentCategoryIds.length <= 1) {
      return;
    }

    const nextCategoryIds = enabled
      ? Array.from(new Set([...currentCategoryIds, categoryId]))
      : currentCategoryIds.filter((currentCategoryId) => currentCategoryId !== categoryId);

    updateComplaintSettings({
      complaintCategoryIds: nextCategoryIds
    });
  };

  const updateSuggestionTopic = (topicId: SuggestionTopicId, enabled: boolean) => {
    const currentTopicIds = suggestionSettings.suggestionTopicIds;

    if (!enabled && currentTopicIds.length <= 1) {
      return;
    }

    const nextTopicIds = enabled
      ? Array.from(new Set([...currentTopicIds, topicId]))
      : currentTopicIds.filter((currentTopicId) => currentTopicId !== topicId);

    updateSuggestionSettings({
      suggestionTopicIds: nextTopicIds
    });
  };

  const updateReviewSettings = (patch: Partial<ReviewModuleSettings>) => {
    if (!organization) return;

    cacheModuleSettings<ReviewModuleSettings>("review", {
      ...reviewSettings,
      ...patch
    });

    const mutationId = (reviewMutationIdRef.current += 1);

    void fetchApiJson<{ settings?: ReviewModuleSettings }>(
      `/api/organizations/${organization.id}/modules/review/settings`,
      {
        body: JSON.stringify(patch),
        headers: {
          "Content-Type": "application/json"
        },
        initDataRaw: tma.initDataRaw,
        method: "PATCH"
      }
    )
      .then((payload) => {
        if (payload.settings && mutationId === reviewMutationIdRef.current) {
          cacheModuleSettings<ReviewModuleSettings>("review", payload.settings);
        }
      })
      .catch(() => undefined);
  };

  const enabledComplaintDetailCount = [
    complaintSettings.photosEnabled,
    complaintSettings.commentRequired,
    complaintSettings.categoriesEnabled
  ].filter(Boolean).length;
  const complaintDetailLockEnabled = enabledComplaintDetailCount <= 1;
  const complaintPhotosLocked =
    complaintSettings.photosEnabled && complaintDetailLockEnabled;
  const complaintCommentLocked =
    complaintSettings.commentRequired && complaintDetailLockEnabled;
  const complaintCategoriesLocked =
    complaintSettings.categoriesEnabled && complaintDetailLockEnabled;

  const reviewGuestInputItems =
    section === "review"
      ? [
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="photo">
                  <ImagePlus size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.review.photos.title")}
                  checked={reviewSettings.photosEnabled}
                  onCheckedChange={(photosEnabled) => updateReviewSettings({ photosEnabled })}
                />
              )
            },
            isAction: false,
            title: t("admin.moduleSettings.review.photos.title")
          },
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="comment">
                  <MessageSquareText size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.review.comment.title")}
                  checked={reviewSettings.commentRequired}
                  onCheckedChange={(commentRequired) => updateReviewSettings({ commentRequired })}
                />
              )
            },
            isAction: false,
            title: t("admin.moduleSettings.review.comment.title")
          }
        ]
      : [];
  const reviewLowRatingItems =
    section === "review"
      ? [
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="warning">
                  <TriangleAlert size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t(
                    `admin.moduleSettings.review.lowRating.${
                      reviewSettings.commentRequired ? "titleRequired" : "titleOptional"
                    }`
                  )}
                  checked={reviewSettings.lowRatingCommentEnabled}
                  onCheckedChange={(lowRatingCommentEnabled) =>
                    updateReviewSettings({ lowRatingCommentEnabled })
                  }
                />
              )
            },
            isAction: false,
            title: t(
              `admin.moduleSettings.review.lowRating.${
                reviewSettings.commentRequired ? "titleRequired" : "titleOptional"
              }`
            )
          },
          ...(reviewSettings.lowRatingCommentEnabled
            ? [
                {
                  addon: {
                    before: (
                      <ModuleSettingIcon tone="rating">
                        <Star size={15} strokeWidth={2.35} />
                      </ModuleSettingIcon>
                    ),
                    after: (
                      <ReviewThresholdControl
                        decreaseLabel={t("admin.moduleSettings.review.thresholdDecrease")}
                        increaseLabel={t("admin.moduleSettings.review.thresholdIncrease")}
                        label={t("admin.moduleSettings.review.thresholdValue", {
                          value: reviewSettings.lowRatingThreshold
                        })}
                        value={reviewSettings.lowRatingThreshold}
                        onChange={(lowRatingThreshold) => {
                          if (lowRatingThreshold === reviewSettings.lowRatingThreshold) {
                            return;
                          }

                          tma.haptics.impact("light");
                          updateReviewSettings({ lowRatingThreshold });
                        }}
                      />
                    )
                  },
                  isAction: false,
                  title: t("admin.moduleSettings.review.threshold")
                },
                {
                  addon: {
                    before: (
                      <ModuleSettingIcon tone="reviewContact">
                        <Phone size={15} strokeWidth={2.35} />
                      </ModuleSettingIcon>
                    ),
                    after: (
                      <Toggle
                        aria-label={t("admin.moduleSettings.review.contact.title")}
                        checked={reviewSettings.contactEnabled}
                        onCheckedChange={(contactEnabled) =>
                          updateReviewSettings({ contactEnabled })
                        }
                      />
                    )
                  },
                  isAction: false,
                  title: t("admin.moduleSettings.review.contact.title")
                }
              ]
            : [])
        ]
      : [];
  const complaintFormItems =
    section === "complaint"
      ? [
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="photo">
                  <ImagePlus size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.complaint.photos.title")}
                  checked={complaintSettings.photosEnabled}
                  disabled={complaintPhotosLocked}
                  onCheckedChange={(photosEnabled) => {
                    if (!photosEnabled && complaintPhotosLocked) {
                      return;
                    }

                    updateComplaintSettings({ photosEnabled });
                  }}
                />
              )
            },
            disabled: complaintPhotosLocked,
            isAction: false,
            title: t("admin.moduleSettings.complaint.photos.title")
          },
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="comment">
                  <MessageSquareText size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.complaint.comment.title")}
                  checked={complaintSettings.commentRequired}
                  disabled={complaintCommentLocked}
                  onCheckedChange={(commentRequired) => {
                    if (!commentRequired && complaintCommentLocked) {
                      return;
                    }

                    updateComplaintSettings({ commentRequired });
                  }}
                />
              )
            },
            disabled: complaintCommentLocked,
            isAction: false,
            title: t("admin.moduleSettings.complaint.comment.title")
          },
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="category">
                  <Tags size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.complaint.categories.title")}
                  checked={complaintSettings.categoriesEnabled}
                  disabled={complaintCategoriesLocked}
                  onCheckedChange={(categoriesEnabled) => {
                    if (!categoriesEnabled && complaintCategoriesLocked) {
                      return;
                    }

                    updateComplaintSettings({ categoriesEnabled });
                  }}
                />
              )
            },
            disabled: complaintCategoriesLocked,
            isAction: false,
            title: t("admin.moduleSettings.complaint.categories.title")
          }
        ]
      : [];
  const complaintCategoryItems =
    section === "complaint"
      ? COMPLAINT_CATEGORY_IDS.map((categoryId) => {
          const meta = complaintCategoryMeta[categoryId];
          const Icon = meta.icon;
          const isSelected = complaintSettings.complaintCategoryIds.includes(categoryId);
          const isLastSelected = isSelected && complaintSettings.complaintCategoryIds.length <= 1;

          return {
            addon: {
              before: (
                <ModuleSettingIcon tone={meta.tone}>
                  <Icon size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t(
                    `admin.moduleSettings.complaint.categoryOptions.${categoryId}.title`
                  )}
                  checked={isSelected}
                  disabled={isLastSelected}
                  onCheckedChange={(enabled) => updateComplaintCategory(categoryId, enabled)}
                />
              )
            },
            disabled: isLastSelected,
            isAction: false,
            subtitle: t(
              `admin.moduleSettings.complaint.categoryOptions.${categoryId}.subtitle`
            ),
            title: t(`admin.moduleSettings.complaint.categoryOptions.${categoryId}.title`)
          };
        })
      : [];
  const complaintContactItems =
    section === "complaint"
      ? [
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="complaintContact">
                  <Phone size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.complaint.contact.title")}
                  checked={complaintSettings.contactEnabled}
                  onCheckedChange={(contactEnabled) => updateComplaintSettings({ contactEnabled })}
                />
              )
            },
            isAction: false,
            title: t("admin.moduleSettings.complaint.contact.title")
          },
          ...(complaintSettings.contactEnabled
            ? [
                {
                  addon: {
                    before: (
                      <ModuleSettingIcon tone="person">
                        <UserRound size={15} strokeWidth={2.35} />
                      </ModuleSettingIcon>
                    ),
                    after: (
                      <Toggle
                        aria-label={t("admin.moduleSettings.complaint.contactRequired.title")}
                        checked={complaintSettings.contactRequired}
                        onCheckedChange={(contactRequired) =>
                          updateComplaintSettings({ contactRequired })
                        }
                      />
                    )
                  },
                  isAction: false,
                  title: t("admin.moduleSettings.complaint.contactRequired.title")
                }
              ]
            : [])
        ]
      : [];
  const suggestionFormItems =
    section === "suggestion"
      ? [
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="photo">
                  <ImagePlus size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.suggestion.photos.title")}
                  checked={suggestionSettings.photosEnabled}
                  onCheckedChange={(photosEnabled) => updateSuggestionSettings({ photosEnabled })}
                />
              )
            },
            isAction: false,
            title: t("admin.moduleSettings.suggestion.photos.title")
          },
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="topic">
                  <Tags size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.suggestion.topics.title")}
                  checked={suggestionSettings.categoriesEnabled}
                  onCheckedChange={(categoriesEnabled) =>
                    updateSuggestionSettings({ categoriesEnabled })
                  }
                />
              )
            },
            isAction: false,
            title: t("admin.moduleSettings.suggestion.topics.title")
          }
        ]
      : [];
  const suggestionTopicItems =
    section === "suggestion"
      ? SUGGESTION_TOPIC_IDS.map((topicId) => {
          const meta = suggestionTopicMeta[topicId];
          const Icon = meta.icon;
          const isSelected = suggestionSettings.suggestionTopicIds.includes(topicId);
          const isLastSelected = isSelected && suggestionSettings.suggestionTopicIds.length <= 1;

          return {
            addon: {
              before: (
                <ModuleSettingIcon tone={meta.tone}>
                  <Icon size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t(`admin.moduleSettings.suggestion.topicOptions.${topicId}.title`)}
                  checked={isSelected}
                  disabled={isLastSelected}
                  onCheckedChange={(enabled) => updateSuggestionTopic(topicId, enabled)}
                />
              )
            },
            disabled: isLastSelected,
            isAction: false,
            subtitle: t(`admin.moduleSettings.suggestion.topicOptions.${topicId}.subtitle`),
            title: t(`admin.moduleSettings.suggestion.topicOptions.${topicId}.title`)
          };
        })
      : [];
  const suggestionContactItems =
    section === "suggestion"
      ? [
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="suggestionContact">
                  <Phone size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.suggestion.contact.title")}
                  checked={suggestionSettings.contactEnabled}
                  onCheckedChange={(contactEnabled) => updateSuggestionSettings({ contactEnabled })}
                />
              )
            },
            isAction: false,
            title: t("admin.moduleSettings.suggestion.contact.title")
          },
          ...(suggestionSettings.contactEnabled
            ? [
                {
                  addon: {
                    before: (
                      <ModuleSettingIcon tone="person">
                        <UserRound size={15} strokeWidth={2.35} />
                      </ModuleSettingIcon>
                    ),
                    after: (
                      <Toggle
                        aria-label={t("admin.moduleSettings.suggestion.contactRequired.title")}
                        checked={suggestionSettings.contactRequired}
                        onCheckedChange={(contactRequired) =>
                          updateSuggestionSettings({ contactRequired })
                        }
                      />
                    )
                  },
                  isAction: false,
                  title: t("admin.moduleSettings.suggestion.contactRequired.title")
                }
              ]
            : [])
        ]
      : [];
  const staffTargetItems =
    section === "staff"
      ? [
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="person">
                  <UserRound size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.staff.guestSelection.title")}
                  checked={staffSettings.guestSelectionEnabled}
                  disabled={staffSettings.guestSelectionEnabled && !staffSettings.allowTeamReview}
                  onCheckedChange={(guestSelectionEnabled) =>
                    updateStaffTargetSettings({ guestSelectionEnabled })
                  }
                />
              )
            },
            isAction: false,
            title: t("admin.moduleSettings.staff.guestSelection.title")
          },
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="team">
                  <UsersRound size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.moduleSettings.staff.teamReview.title")}
                  checked={staffSettings.allowTeamReview}
                  disabled={!staffSettings.guestSelectionEnabled && staffSettings.allowTeamReview}
                  onCheckedChange={(allowTeamReview) =>
                    updateStaffTargetSettings({ allowTeamReview })
                  }
                />
              )
            },
            isAction: false,
            title: t("admin.moduleSettings.staff.teamReview.title")
          }
        ]
      : [];
  const staffMemberItems =
    section === "staff"
      ? [
          ...(staffMembers.length > 0
            ? staffMembers.map((staffMember) => ({
                addon: {
                  before: staffMember.avatarUrl ? (
                    <Avatar
                      alt={staffMember.displayName}
                      className={`size-[30px] rounded-[9px] ${staffMember.isActive ? "" : "opacity-60 grayscale"}`}
                      initialsClassName="ios-caption-1"
                      name={staffMember.displayName}
                      seed={staffMember.id}
                      src={staffMember.avatarUrl}
                    />
                  ) : (
                    <ModuleSettingIcon tone={staffMember.isActive ? "staff" : "inactive"}>
                      <UserRound size={15} strokeWidth={2.35} />
                    </ModuleSettingIcon>
                  ),
                  after: staffMember.isActive ? undefined : (
                    <span className="ios-caption-1 inline-flex items-center gap-1 font-medium text-muted">
                      <EyeOff size={13} strokeWidth={2.35} />
                      {t("admin.moduleSettings.staff.inactive")}
                    </span>
                  )
                },
                href: organization
                  ? `/admin/${organization.id}/staff/${staffMember.id}`
                  : undefined,
                subtitle: staffMember.roleTitle || undefined,
                title: staffMember.displayName
              }))
            : [
                {
                  addon: {
                    before: (
                      <ModuleSettingIcon tone="empty">
                        <UsersRound size={15} strokeWidth={2.35} />
                      </ModuleSettingIcon>
                    )
                  },
                  isAction: false,
                  title: t("admin.moduleSettings.staff.empty.title")
                }
              ]),
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="add">
                  <Plus size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              )
            },
            disabled: !organization,
            href: organization ? `/admin/${organization.id}/staff/new` : undefined,
            title: t("admin.moduleSettings.staff.add.title")
          }
        ]
      : [];
  const canDisableOwnerDm =
    notificationSettings.telegramGroupEnabled && Boolean(notificationSettings.telegramGroupChatId);
  const notificationModeItems =
    section === "notifications"
      ? notificationModes.map((mode) => {
          const active = notificationSettings.mode === mode;

          return {
            addon: {
              before: (
                <ModuleSettingIcon
                  tone={mode === "OFF" ? "off" : mode === "IMPORTANT_ONLY" ? "important" : "send"}
                >
                  {mode === "OFF" ? (
                    <Bell size={15} strokeWidth={2.35} />
                  ) : mode === "IMPORTANT_ONLY" ? (
                    <BellRing size={15} strokeWidth={2.35} />
                  ) : (
                    <Send size={15} strokeWidth={2.35} />
                  )}
                </ModuleSettingIcon>
              ),
              after: active ? <Check size={16} strokeWidth={2.5} /> : undefined
            },
            onClick: () => updateNotificationSettings({ mode }),
            title: t(`admin.notificationSettings.mode.${mode}.title`)
          };
        })
      : [];
  const notificationDeliveryItems =
    section === "notifications"
      ? [
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="person">
                  <UserRound size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: (
                <Toggle
                  aria-label={t("admin.notificationSettings.delivery.owner.title")}
                  checked={notificationSettings.ownerDmEnabled}
                  disabled={!canDisableOwnerDm && notificationSettings.ownerDmEnabled}
                  onCheckedChange={(ownerDmEnabled) =>
                    updateNotificationSettings({ ownerDmEnabled })
                  }
                />
              )
            },
            isAction: false,
            title: t("admin.notificationSettings.delivery.owner.title")
          },
          {
            addon: {
              before: (
                <ModuleSettingIcon tone="group">
                  <UsersRound size={15} strokeWidth={2.35} />
                </ModuleSettingIcon>
              ),
              after: notificationSettings.telegramGroupChatId ? (
                <Toggle
                  aria-label={t("admin.notificationSettings.delivery.group.title")}
                  checked={notificationSettings.telegramGroupEnabled}
                  onCheckedChange={(telegramGroupEnabled) =>
                    updateNotificationSettings({ telegramGroupEnabled })
                  }
                />
              ) : (
                <span className="ios-subhead font-medium text-muted">
                  {t("admin.notificationSettings.delivery.group.empty")}
                </span>
              )
            },
            isAction: false,
            title: t("admin.notificationSettings.delivery.group.title")
          }
        ]
      : [];
  const isCurrentSettingsLoading =
    isOrganizationLoading ||
    (section === "review" && reviewSettingsQuery.isLoading) ||
    (section === "complaint" && complaintSettingsQuery.isLoading) ||
    (section === "suggestion" && suggestionSettingsQuery.isLoading) ||
    (section === "staff" && (staffSettingsQuery.isLoading || staffMembersQuery.isLoading)) ||
    (section === "notifications" && notificationSettingsQuery.isLoading);

  if (isGuestMenuLoading || (showModuleSettings && isCurrentSettingsLoading)) {
    return (
      <PageTransition>
        <PendingScreen label={t("common.loading")} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="tma-page bg-surface text-foreground">
        <div className="account-shell">
          <section className="grid gap-2 px-4">
            <h2 className="ios-title-1 font-semibold tracking-normal text-foreground">{label}</h2>
            <p className="ios-footnote text-muted">{t(`admin.sections.${section}.hint`)}</p>
          </section>

          {guestMenuItemId ? (
            <List
              hint={t(
                section === "staff" ? "admin.sections.staff.showHint" : "admin.sections.showHint"
              )}
              items={[
                {
                  addon: {
                    after: (
                      <Toggle
                        aria-label={t(
                          section === "staff" ? "admin.sections.staff.show" : "admin.sections.show"
                        )}
                        checked={guestMenuEnabled === true}
                        onCheckedChange={updateGuestMenuEnabled}
                      />
                    )
                  },
                  isAction: false,
                  title: t(
                    section === "staff" ? "admin.sections.staff.show" : "admin.sections.show"
                  )
                }
              ]}
            />
          ) : null}

          <AnimatePresence initial={false}>
            {showModuleSettings && !isCurrentSettingsLoading ? (
              <motion.div
                key={`${section}-settings`}
                animate={{ opacity: 1 }}
                className="grid gap-6"
                exit={{ opacity: 0 }}
                initial={shouldAnimateModuleSettings ? { opacity: 0 } : false}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {section === "review" ? (
                  <>
                    <List
                      title={t("admin.moduleSettings.review.guestInput.title")}
                      hint={t("admin.moduleSettings.review.guestInput.hint")}
                      items={reviewGuestInputItems}
                    />
                    <List
                      title={t("admin.moduleSettings.review.lowRatingGroup.title")}
                      hint={t(
                        `admin.moduleSettings.review.lowRatingGroup.${
                          reviewSettings.commentRequired ? "hintRequired" : "hintOptional"
                        }`
                      )}
                      items={reviewLowRatingItems}
                    />
                  </>
                ) : section === "complaint" ? (
                  <>
                    <List
                      title={t("admin.moduleSettings.complaint.form.title")}
                      hint={t("admin.moduleSettings.complaint.form.hint")}
                      items={complaintFormItems}
                    />
                    <AnimatePresence initial={false}>
                      {complaintSettings.categoriesEnabled ? (
                        <motion.div
                          key="complaint-categories"
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          initial={{ opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                          <List
                            title={t("admin.moduleSettings.complaint.categoryList.title")}
                            hint={t("admin.moduleSettings.complaint.categoryList.hint")}
                            items={complaintCategoryItems}
                          />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                    <List
                      title={t("admin.moduleSettings.complaint.reply.title")}
                      hint={t("admin.moduleSettings.complaint.reply.hint")}
                      items={complaintContactItems}
                    />
                  </>
                ) : section === "suggestion" ? (
                  <>
                    <List
                      title={t("admin.moduleSettings.suggestion.form.title")}
                      hint={t("admin.moduleSettings.suggestion.form.hint")}
                      items={suggestionFormItems}
                    />
                    <AnimatePresence initial={false}>
                      {suggestionSettings.categoriesEnabled ? (
                        <motion.div
                          key="suggestion-topics"
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          initial={{ opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                          <List
                            title={t("admin.moduleSettings.suggestion.topicList.title")}
                            hint={t("admin.moduleSettings.suggestion.topicList.hint")}
                            items={suggestionTopicItems}
                          />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                    <List
                      title={t("admin.moduleSettings.suggestion.reply.title")}
                      hint={t("admin.moduleSettings.suggestion.reply.hint")}
                      items={suggestionContactItems}
                    />
                  </>
                ) : section === "staff" ? (
                  <>
                    <List
                      title={t("admin.moduleSettings.staff.selection.title")}
                      hint={t("admin.moduleSettings.staff.selection.hint")}
                      items={staffTargetItems}
                    />
                    <List
                      title={t("admin.moduleSettings.staff.people.title")}
                      hint={t("admin.moduleSettings.staff.people.hint")}
                      items={staffMemberItems}
                    />
                  </>
                ) : section === "notifications" ? (
                  <>
                    <List
                      title={t("admin.notificationSettings.mode.title")}
                      hint={t("admin.notificationSettings.mode.hint")}
                      items={notificationModeItems}
                    />
                    <AnimatePresence initial={false}>
                      {notificationSettings.mode !== "OFF" ? (
                        <motion.div
                          key="notification-delivery"
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          initial={{ opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                          <List
                            title={t("admin.notificationSettings.delivery.title")}
                            hint={t("admin.notificationSettings.delivery.hint")}
                            items={notificationDeliveryItems}
                          />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </>
                ) : (
                  <List
                    hint={t("admin.sectionShellHint")}
                    items={rows.map((row, index) => ({
                      addon: {
                        before: (
                          <ModuleSettingIcon
                            tone={fallbackRowTones[index % fallbackRowTones.length]}
                          >
                            <FallbackSectionIcon size={15} strokeWidth={2.35} />
                          </ModuleSettingIcon>
                        )
                      },
                      isAction: false,
                      title: row
                    }))}
                  />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </main>
    </PageTransition>
  );
};
