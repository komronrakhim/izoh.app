import type { User } from "../../../prisma/generated/prisma/client";

import type { DomainDb } from "~/server/domain/shared";
import type { TelegramInitDataUser } from "~/server/telegram";
import { normalizeAppLocale, toPrismaLocale } from "~/shared/i18n/config";

export const syncUserFromTelegram = async (
  telegramInitUser: TelegramInitDataUser,
  db: DomainDb
): Promise<User> => {
  const telegramId = BigInt(telegramInitUser.id);
  const telegramLocale = toPrismaLocale(normalizeAppLocale(telegramInitUser.language_code));
  const existingUser = await db.user.findUnique({
    where: {
      telegram_id: telegramId
    }
  });

  if (existingUser) {
    return db.user.update({
      data: {
        first_name: telegramInitUser.first_name,
        language_code: telegramInitUser.language_code,
        last_name: telegramInitUser.last_name,
        locale: existingUser.locale_source === "MANUAL" ? existingUser.locale : telegramLocale,
        locale_source:
          existingUser.locale_source === "MANUAL" ? existingUser.locale_source : "TELEGRAM",
        photo_url: telegramInitUser.photo_url,
        username: telegramInitUser.username
      },
      where: {
        id: existingUser.id
      }
    });
  }

  return db.user.create({
    data: {
      first_name: telegramInitUser.first_name,
      language_code: telegramInitUser.language_code,
      last_name: telegramInitUser.last_name,
      locale: telegramLocale,
      locale_source: "TELEGRAM",
      photo_url: telegramInitUser.photo_url,
      telegram_id: telegramId,
      username: telegramInitUser.username
    }
  });
};
