import type { AppLocale, SubmissionKind } from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { createTranslator, fromPrismaLocale } from "~/shared/i18n";
import {
  getDefaultNotificationSettings,
  isImportantSubmission,
  shouldSendNotification
} from "~/shared/notifications";
import { safeParseSubmissionMetadata } from "~/shared/submissions";
import { getTelegramBot } from "./bot";

const kindLabel = (kind: SubmissionKind, locale: AppLocale) => {
  const t = createTranslator(fromPrismaLocale(locale));

  if (kind === "REVIEW") return t("telegram.notifications.kind.review");
  if (kind === "COMPLAINT") return t("telegram.notifications.kind.complaint");

  return t("telegram.notifications.kind.suggestion");
};

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const getHeadlineKey = ({ kind, rating }: { kind: SubmissionKind; rating: null | number }) => {
  if (kind === "COMPLAINT") return "telegram.notifications.headline.complaint";
  if (kind === "SUGGESTION") return "telegram.notifications.headline.suggestion";
  if (isImportantSubmission({ kind, rating })) return "telegram.notifications.headline.lowReview";

  return "telegram.notifications.headline.review";
};

const getHeadlineEmoji = ({ kind, rating }: { kind: SubmissionKind; rating: null | number }) => {
  if (kind === "COMPLAINT") return "🚩";
  if (kind === "SUGGESTION") return "💡";
  if (isImportantSubmission({ kind, rating })) return "⚠️";

  return "⭐";
};

const getDetailIcon = (
  field: "type" | "rating" | "signal" | "topics" | "staff" | "contact" | "source"
) => {
  const icons = {
    type: "🎯",
    rating: "🧮",
    signal: "🚨",
    topics: "🏷️",
    staff: "👤",
    contact: "📞",
    source: "🌐"
  } as const;

  return icons[field];
};

const formatDetailLine = (icon: string, label: string, value: string) =>
  `${icon} <b>${label}</b>: ${value}`;

const formatRatingVisual = (rating: number) => {
  const value = Math.max(1, Math.min(5, Math.round(rating)));
  return `${"★".repeat(value)}${"☆".repeat(5 - value)}`;
};

const buildSection = (title: string, lines: (string | null)[]) => {
  const filtered = lines.filter(Boolean) as string[];

  if (filtered.length === 0) {
    return [];
  }

  return [`<b>${title}</b>`, ...filtered, ""];
};

const getTopicLabels = ({
  locale,
  metadata,
  kind
}: {
  kind: SubmissionKind;
  locale: AppLocale;
  metadata: unknown;
}) => {
  const parsedMetadata = safeParseSubmissionMetadata(metadata);
  const t = createTranslator(fromPrismaLocale(locale));

  if (kind === "COMPLAINT") {
    return (parsedMetadata.complaintCategoryIds ?? []).map((id) =>
      t(`customer.topicOptions.complaint.${id}`)
    );
  }

  if (kind === "SUGGESTION") {
    return (parsedMetadata.suggestionTopicIds ?? []).map((id) =>
      t(`customer.topicOptions.suggestion.${id}`)
    );
  }

  return [];
};

const trimPlainText = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3))}...` : value;

const compactHtmlMessage = ({
  build,
  maxLength
}: {
  build: (bodyMaxLength: number) => string;
  maxLength: number;
}) => {
  let bodyMaxLength = 1800;
  let message = build(bodyMaxLength);

  while (message.length > maxLength && bodyMaxLength > 120) {
    bodyMaxLength = Math.floor(bodyMaxLength * 0.72);
    message = build(bodyMaxLength);
  }

  return message.length > maxLength ? build(80) : message;
};

type NotificationSubmission = {
  body_text: string;
  customer_contact_phone: null | string;
  customer_display_name: null | string;
  kind: SubmissionKind;
  metadata: unknown;
  organization: {
    name: string;
  };
  qr_context: null | string;
  rating: null | number;
  target_staff_member: null | {
    display_name: string;
    role_title: string;
  };
};

export const formatSubmissionNotificationText = ({
  locale,
  maxLength = 3800,
  photoCount = 0,
  submission
}: {
  locale: AppLocale;
  maxLength?: number;
  photoCount?: number;
  submission: NotificationSubmission;
}) => {
  const t = createTranslator(fromPrismaLocale(locale));
  const parsedMetadata = safeParseSubmissionMetadata(submission.metadata);
  const topicLabels = getTopicLabels({
    kind: submission.kind,
    locale,
    metadata: submission.metadata
  });
  const staffLabel = (() => {
    if (submission.target_staff_member) {
      return [
        submission.target_staff_member.display_name,
        submission.target_staff_member.role_title || null
      ]
        .filter(Boolean)
        .join(" · ");
    }

    if (parsedMetadata.staffTargetSnapshot) {
      return [
        parsedMetadata.staffTargetSnapshot.displayName,
        parsedMetadata.staffTargetSnapshot.roleTitle || null
      ]
        .filter(Boolean)
        .join(" · ");
    }

    if (parsedMetadata.staffTargetType === "team") {
      return t("telegram.notifications.staffTarget.team");
    }

    if (parsedMetadata.staffTargetType === "unknown") {
      return t("telegram.notifications.staffTarget.unknown");
    }

    return null;
  })();
  const important = isImportantSubmission({
    kind: submission.kind,
    rating: submission.rating
  });

  return compactHtmlMessage({
    maxLength,
    build: (bodyMaxLength) => {
      const bodyText = trimPlainText(submission.body_text.trim(), bodyMaxLength);
      const guestLines: (string | null)[] = [
        submission.customer_display_name
          ? formatDetailLine(
              "🪪",
              escapeHtml(t("telegram.notifications.fields.customer")),
              escapeHtml(submission.customer_display_name)
            )
          : null,
        submission.customer_contact_phone
          ? formatDetailLine(
              getDetailIcon("contact"),
              escapeHtml(t("telegram.notifications.fields.contact")),
              escapeHtml(submission.customer_contact_phone)
            )
          : null
      ];
      const summaryLines = [
        formatDetailLine(
          getDetailIcon("type"),
          escapeHtml(t("telegram.notifications.fields.kind")),
          escapeHtml(kindLabel(submission.kind, locale))
        ),
        submission.rating
          ? formatDetailLine(
              getDetailIcon("rating"),
              escapeHtml(t("telegram.notifications.fields.rating")),
              `<b>${escapeHtml(formatRatingVisual(submission.rating))}</b> (${escapeHtml(String(submission.rating))}/5)`
            )
          : null,
        submission.qr_context
          ? formatDetailLine(
              getDetailIcon("source"),
              escapeHtml(t("telegram.notifications.fields.source")),
              escapeHtml(submission.qr_context)
            )
          : null,
        important
          ? formatDetailLine(
              getDetailIcon("signal"),
              escapeHtml(t("telegram.notifications.fields.signal")),
              escapeHtml(
                t(
                  submission.kind === "REVIEW"
                    ? "telegram.notifications.signals.lowRating"
                    : "telegram.notifications.signals.important"
                )
              )
            )
          : null,
        photoCount > 0
          ? formatDetailLine(
              "🖼️",
              escapeHtml(t("telegram.notifications.fields.attachments")),
              escapeHtml(String(photoCount))
            )
          : null
      ].filter(Boolean);

      const detailLines = [
        topicLabels.length > 0
          ? formatDetailLine(
              getDetailIcon("topics"),
              escapeHtml(t("telegram.notifications.fields.topics")),
              escapeHtml(topicLabels.join(", "))
            )
          : null,
        staffLabel
          ? formatDetailLine(
              getDetailIcon("staff"),
              escapeHtml(t("telegram.notifications.fields.staff")),
              escapeHtml(staffLabel)
            )
          : null,
      ].filter(Boolean);

      return [
        `${getHeadlineEmoji(submission)} <b>${escapeHtml(t(getHeadlineKey(submission)))}</b>`,
        "",
        ...buildSection(`🧭 ${escapeHtml(t("telegram.notifications.sections.summary"))}`, summaryLines),
        ...buildSection(`🏪 ${escapeHtml(t("telegram.notifications.sections.place"))}`, [
          escapeHtml(submission.organization.name)
        ]),
        ...buildSection(`👤 ${escapeHtml(t("telegram.notifications.sections.guest"))}`, guestLines),
        ...buildSection(`🧾 ${escapeHtml(t("telegram.notifications.sections.details"))}`, [
          ...detailLines
        ]),
        ...buildSection(`💬 ${escapeHtml(t("telegram.notifications.sections.message"))}`, [
          bodyText
            ? `<i>${escapeHtml(bodyText)}</i>`
            : `<i>${escapeHtml(t("telegram.notifications.emptyText"))}</i>`
        ]),
        ""
      ].join("\n");
    }
  });
};

export const notifySubmissionRecipients = async (
  submissionId: string,
  db: DomainDb = getDomainDb()
) => {
  const submission = await db.submission.findUnique({
    include: {
      attachments: {
        include: {
          media_asset: true
        },
        orderBy: {
          sort_order: "asc"
        },
        take: 4
      },
      organization: {
        include: {
          notification_setting: true,
          owner: true
        }
      },
      target_staff_member: true
    },
    where: {
      id: submissionId
    }
  });

  if (!submission) {
    throw new Error("Submission was not found.");
  }

  const setting = submission.organization.notification_setting;
  const notificationSettings = {
    ...getDefaultNotificationSettings(submission.organization.id),
    ...(setting
      ? {
          mode: setting.mode,
          ownerDmEnabled: setting.owner_dm_enabled,
          telegramGroupChatId: setting.telegram_group_chat_id?.toString() ?? null,
          telegramGroupEnabled: setting.telegram_group_enabled,
          telegramGroupTitle: setting.telegram_group_title
        }
      : {})
  };

  if (!shouldSendNotification(notificationSettings, submission)) {
    return;
  }

  const targets = [
    ...(notificationSettings.ownerDmEnabled
      ? [
          {
            chatId: submission.organization.owner.telegram_id,
            locale: submission.organization.owner.locale,
            recipientUserId: submission.organization.owner_user_id,
            targetType: "OWNER_DM" as const
          }
        ]
      : []),
    ...(notificationSettings.telegramGroupEnabled && setting?.telegram_group_chat_id
      ? [
          {
            chatId: setting.telegram_group_chat_id,
            locale: submission.organization.locale,
            recipientUserId: null,
            targetType: "TELEGRAM_GROUP" as const
          }
        ]
      : [])
  ];

  if (targets.length === 0) {
    return;
  }

  const bot = getTelegramBot();

  for (const target of targets) {
    const locale = target.locale;
    const photoUrls = submission.attachments
      .map((attachment) => attachment.media_asset.public_url)
      .slice(0, 4);
    const text = formatSubmissionNotificationText({
      locale,
      photoCount: photoUrls.length,
      maxLength: photoUrls.length > 0 ? 1000 : 3800,
      submission
    });

    try {
      if (photoUrls.length > 0) {
        const messages = await bot.api.sendMediaGroup(
          target.chatId.toString(),
          photoUrls.map((url, index) => ({
            caption: index === 0 ? text : undefined,
            media: url,
            parse_mode: index === 0 ? "HTML" : undefined,
            type: "photo" as const
          }))
        );

        await db.telegramNotificationDelivery.create({
          data: {
            recipient_user_id: target.recipientUserId,
            sent_at: new Date(),
            status: "SENT",
            submission_id: submission.id,
            target_type: target.targetType,
            telegram_chat_id: target.chatId,
            telegram_message_ids: messages.map((message) => message.message_id)
          }
        });
      } else {
        const message = await bot.api.sendMessage(target.chatId.toString(), text, {
          parse_mode: "HTML"
        });

        await db.telegramNotificationDelivery.create({
          data: {
            recipient_user_id: target.recipientUserId,
            sent_at: new Date(),
            status: "SENT",
            submission_id: submission.id,
            target_type: target.targetType,
            telegram_chat_id: target.chatId,
            telegram_message_ids: [message.message_id]
          }
        });
      }
    } catch (error) {
      await db.telegramNotificationDelivery.create({
        data: {
          error: error instanceof Error ? error.message : "Unknown Telegram delivery error.",
          recipient_user_id: target.recipientUserId,
          status: "FAILED",
          submission_id: submission.id,
          target_type: target.targetType,
          telegram_chat_id: target.chatId
        }
      });
    }
  }
};
