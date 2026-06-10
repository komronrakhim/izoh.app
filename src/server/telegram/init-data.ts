import { createHmac, timingSafeEqual } from "node:crypto";

type ValidateTelegramInitDataInput = {
  botToken: string;
  initData: string;
  maxAgeSeconds?: number;
};

export type TelegramInitDataUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

export type ValidatedTelegramInitData = {
  authDate: Date;
  queryId?: string;
  raw: URLSearchParams;
  startParam?: string;
  user?: TelegramInitDataUser;
};

const createDataCheckString = (params: URLSearchParams) =>
  [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

const safeEqualHex = (actualHex: string, expectedHex: string) => {
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const validateTelegramInitData = ({
  botToken,
  initData,
  maxAgeSeconds = 60 * 60 * 24
}: ValidateTelegramInitDataInput): ValidatedTelegramInitData => {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDateRaw = params.get("auth_date");

  if (!hash || !authDateRaw) {
    throw new Error("Telegram init data is missing required fields.");
  }

  const authDateSeconds = Number(authDateRaw);

  if (!Number.isFinite(authDateSeconds)) {
    throw new Error("Telegram init data auth date is invalid.");
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDateSeconds;

  if (ageSeconds > maxAgeSeconds) {
    throw new Error("Telegram init data is expired.");
  }

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secret)
    .update(createDataCheckString(params))
    .digest("hex");

  if (!safeEqualHex(hash, expectedHash)) {
    throw new Error("Telegram init data signature is invalid.");
  }

  const userRaw = params.get("user");
  const user = userRaw ? (JSON.parse(userRaw) as TelegramInitDataUser) : undefined;

  return {
    authDate: new Date(authDateSeconds * 1000),
    queryId: params.get("query_id") ?? undefined,
    raw: params,
    startParam: params.get("start_param") ?? undefined,
    user
  };
};
