import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { validateTelegramContactData, validateTelegramInitData } from "~/server/telegram";

const botToken = "123456:TEST_TOKEN";

const createSignedInitData = (data: Record<string, string>) => {
  const params = new URLSearchParams(data);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  params.set("hash", hash);

  return params.toString();
};

describe("validateTelegramInitData", () => {
  it("accepts signed Telegram init data", () => {
    const initData = createSignedInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: "query",
      start_param: "organization_payload",
      user: JSON.stringify({
        first_name: "Komron",
        id: 123,
        language_code: "ru",
        username: "komron"
      })
    });

    const result = validateTelegramInitData({
      botToken,
      initData
    });

    expect(result.user?.id).toBe(123);
    expect(result.startParam).toBe("organization_payload");
  });

  it("rejects tampered Telegram init data", () => {
    const initData = createSignedInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({
        first_name: "Komron",
        id: 123
      })
    }).replace("Komron", "Other");

    expect(() =>
      validateTelegramInitData({
        botToken,
        initData
      })
    ).toThrow("signature");
  });

  it("accepts signed Telegram contact data", () => {
    const contactData = createSignedInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      contact: JSON.stringify({
        first_name: "Komron",
        phone_number: "+998901234567",
        user_id: 123
      })
    });

    const result = validateTelegramContactData({
      botToken,
      contactData
    });

    expect(result.contact.user_id).toBe(123);
    expect(result.contact.phone_number).toBe("+998901234567");
  });
});
