import { Bot } from "grammy";

import { getRequiredEnv } from "~/server/config/env";

let bot: Bot | null = null;

export const getTelegramBot = () => {
  if (!bot) {
    bot = new Bot(getRequiredEnv("TELEGRAM_BOT_TOKEN"));
  }

  return bot;
};
