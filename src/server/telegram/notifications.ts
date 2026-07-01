import type { SubmissionKind } from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { getMediaPublicUrl } from "~/server/media/public-url";
import { fromPrismaLocale } from "~/shared/i18n";
import { createTranslator } from "~/shared/i18n/server";
import type { AppLocale } from "~/shared/i18n";
import { isImportantSubmission } from "~/shared/notifications";
import { getRatingEmoji, getRatingLabelKey, normalizeRatingValue } from "~/shared/ratings";
import { safeParseSubmissionMetadata } from "~/shared/submissions";
import { getTelegramBot } from "./bot";

export class TelegramPermanentDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramPermanentDeliveryError";
  }
}

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

const formatLabeledLine = (icon: string, label: string, value: string) =>
  `${icon} ${label}: ${value}`;

const formatTopicList = (values: string[]) => values.join(" · ");

const formatRatingText = ({ locale, rating }: { locale: AppLocale; rating: number }) => {
  const t = createTranslator(fromPrismaLocale(locale));
  const value = normalizeRatingValue(rating);

  return `${getRatingEmoji(value)} ${t(getRatingLabelKey(value))}`;
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
  submission
}: {
  locale: AppLocale;
  maxLength?: number;
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
    if (parsedMetadata.staffTargetSnapshot) {
      return [
        parsedMetadata.staffTargetSnapshot.displayName,
        parsedMetadata.staffTargetSnapshot.roleTitle || null
      ]
        .filter(Boolean)
        .join(" · ");
    }

    if (submission.target_staff_member) {
      return [
        submission.target_staff_member.display_name,
        submission.target_staff_member.role_title || null
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
  return compactHtmlMessage({
    maxLength,
    build: (bodyMaxLength) => {
      const bodyText = trimPlainText(submission.body_text.trim(), bodyMaxLength);
      const headlineParts = [
        `${getHeadlineEmoji(submission)} <b>${escapeHtml(t(getHeadlineKey(submission)))}</b>`,
        submission.rating
          ? escapeHtml(
              formatRatingText({
                locale,
                rating: submission.rating
              })
            )
          : null
      ].filter(Boolean);
      const detailLines = [
        topicLabels.length > 0 ? `🏷 ${escapeHtml(formatTopicList(topicLabels))}` : null,
        staffLabel ? `👤 ${escapeHtml(staffLabel)}` : null,
        submission.qr_context ? `📍 ${escapeHtml(submission.qr_context)}` : null,
        submission.customer_display_name
          ? formatLabeledLine(
              "🪪",
              escapeHtml(t("telegram.notifications.fields.customer")),
              escapeHtml(submission.customer_display_name)
            )
          : null,
        submission.customer_contact_phone
          ? formatLabeledLine(
              "📞",
              escapeHtml(t("telegram.notifications.fields.contact")),
              escapeHtml(submission.customer_contact_phone)
            )
          : null
      ].filter(Boolean);
      const messageText = bodyText
        ? `<i>${escapeHtml(bodyText)}</i>`
        : escapeHtml(t(`telegram.notifications.emptyText.${submission.kind}`));

      return [
        `🏪 <b>${escapeHtml(submission.organization.name)}</b>`,
        headlineParts.join(" · "),
        "",
        messageText,
        detailLines.length > 0 ? "" : null,
        ...detailLines,
        ""
      ]
        .filter((line): line is string => line !== null)
        .join("\n");
    }
  });
};

export const sendTelegramNotificationDelivery = async (
  deliveryId: string,
  db: DomainDb = getDomainDb()
) => {
  const delivery = await db.telegramNotificationDelivery.findUnique({
    include: {
      recipient_user: true,
      submission: {
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
          organization: true,
          target_staff_member: true
        }
      },
      target: {
        include: {
          recipient_user: true
        }
      }
    },
    where: {
      id: deliveryId
    }
  });

  if (!delivery) {
    throw new TelegramPermanentDeliveryError("Notification delivery was not found.");
  }

  if (
    delivery.target.status !== "ACTIVE" ||
    (delivery.target.type === "OWNER_DM" && delivery.target.mode === "OFF")
  ) {
    await db.telegramNotificationDelivery.update({
      data: {
        locked_until: null,
        status: "SKIPPED"
      },
      where: {
        id: delivery.id
      }
    });

    return {
      status: "SKIPPED" as const
    };
  }

  const recipientUser = delivery.target.recipient_user ?? delivery.recipient_user;
  const chatId =
    delivery.target.type === "OWNER_DM"
      ? recipientUser?.telegram_id
      : delivery.target.telegram_chat_id;
  const locale = fromPrismaLocale(
    delivery.target.type === "OWNER_DM"
      ? (recipientUser?.locale ?? delivery.submission.organization.locale)
      : delivery.submission.organization.locale
  );

  if (!chatId) {
    throw new TelegramPermanentDeliveryError("Notification target has no Telegram chat.");
  }

  const bot = getTelegramBot();
  const photoUrls = delivery.submission.attachments
    .map((attachment) => getMediaPublicUrl(attachment.media_asset))
    .slice(0, 4);
  const text = formatSubmissionNotificationText({
    locale,
    maxLength: photoUrls.length > 0 ? 1000 : 3800,
    submission: delivery.submission
  });
  const sentAt = new Date();

  if (photoUrls.length > 0) {
    const messages = await bot.api.sendMediaGroup(
      chatId.toString(),
      photoUrls.map((url, index) => ({
        caption: index === 0 ? text : undefined,
        media: url,
        parse_mode: index === 0 ? "HTML" : undefined,
        type: "photo" as const
      }))
    );

    await db.telegramNotificationDelivery.update({
      data: {
        locked_until: null,
        sent_at: sentAt,
        status: "SENT",
        telegram_chat_id: chatId,
        telegram_message_ids: messages.map((message) => message.message_id)
      },
      where: {
        id: delivery.id
      }
    });

    return {
      status: "SENT" as const
    };
  }

  const message = await bot.api.sendMessage(chatId.toString(), text, {
    parse_mode: "HTML"
  });

  await db.telegramNotificationDelivery.update({
    data: {
      locked_until: null,
      sent_at: sentAt,
      status: "SENT",
      telegram_chat_id: chatId,
      telegram_message_ids: [message.message_id]
    },
    where: {
      id: delivery.id
    }
  });

  return {
    status: "SENT" as const
  };
};
