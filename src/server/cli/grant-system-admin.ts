import { getPrisma } from "~/server/db";
import { DEFAULT_LOCALE } from "~/shared/i18n";

const telegramIdArg = process.argv[2];

if (!telegramIdArg) {
  console.error("Usage: npm run admin:grant -- <telegram_user_id>");
  process.exit(1);
}

let telegramId: bigint;

try {
  telegramId = BigInt(telegramIdArg);
} catch {
  console.error("Telegram user id must be a number.");
  process.exit(1);
}

const db = getPrisma();

if (!db) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

try {
  const user = await db.user.upsert({
    create: {
      first_name: "Telegram User",
      locale: DEFAULT_LOCALE,
      locale_source: "TELEGRAM",
      system_role: "ADMIN",
      telegram_id: telegramId
    },
    select: {
      first_name: true,
      id: true,
      system_role: true,
      telegram_id: true,
      username: true
    },
    update: {
      system_role: "ADMIN"
    },
    where: {
      telegram_id: telegramId
    }
  });

  console.log(
    [
      "System admin granted.",
      `User: ${user.first_name}${user.username ? ` (@${user.username})` : ""}`,
      `Telegram ID: ${user.telegram_id.toString()}`,
      `Role: ${user.system_role}`
    ].join("\n")
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? `Failed to grant system admin: ${error.message}`
      : "Failed to grant system admin."
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
