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

export const syncUserContactFromTelegram = async (
  {
    firstName,
    languageCode,
    lastName,
    phoneNumber,
    telegramId,
    username
  }: {
    firstName?: string;
    languageCode?: string;
    lastName?: string;
    phoneNumber: string;
    telegramId: bigint;
    username?: string;
  },
  db: DomainDb
): Promise<User> => {
  const normalizedPhoneNumber = phoneNumber.replace(/\s+/g, " ").trim();

  if (!normalizedPhoneNumber) {
    throw new Error("Telegram contact phone number is required.");
  }

  const user = await syncUserFromTelegram(
    {
      first_name: firstName?.trim() || "Guest",
      id: telegramId.toString(),
      language_code: languageCode,
      last_name: lastName,
      username
    },
    db
  );

  return db.user.update({
    data: {
      phone_number: normalizedPhoneNumber
    },
    where: {
      id: user.id
    }
  });
};
