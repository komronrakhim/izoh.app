import { describe, expect, it } from "vitest";

import { formatSubmissionNotificationText } from "~/server/telegram";

const normalizeTelegramText = (value: string) => value.replace(/<[^>]+>/g, "");

describe("Telegram submission notifications", () => {
  it("formats a low review as an important Russian notification without changing its kind", () => {
    const message = formatSubmissionNotificationText({
      locale: "RU",
      submission: {
        body_text: "Кофе был холодный <script>",
        customer_display_name: "Анонимный клиент",
        customer_contact_phone: "@guest",
        kind: "REVIEW",
        metadata: {
          wizardChoiceId: "ok"
        },
        organization: {
          name: "Coffee Place"
        },
        qr_context: "Стол 4",
        rating: 2,
        target_staff_member: {
          display_name: "Komron",
          role_title: "Кассир"
        }
      }
    });

    const normalized = normalizeTelegramText(message);

    expect(normalized).toContain("Низкая оценка");
    expect(normalized).toContain("Тип: Отзыв");
    expect(normalized).toContain("Оценка: 2/5");
    expect(normalized).toContain("Сигнал: нужна внимательность");
    expect(normalized).toContain("Откуда: Стол 4");
    expect(normalized).toContain("Кого касается: Komron · Кассир");
    expect(normalized).toContain("Контакт: @guest");
    expect(message).toContain("Кофе был холодный &lt;script&gt;");
  });

  it("formats complaint topics in the recipient locale", () => {
    const message = formatSubmissionNotificationText({
      locale: "UZ",
      submission: {
        body_text: "Juda uzoq kutdik",
        customer_display_name: null,
        customer_contact_phone: null,
        kind: "COMPLAINT",
        metadata: {
          complaintCategoryIds: ["wait"],
          wizardChoiceId: "issue"
        },
        organization: {
          name: "Coffee Place"
        },
        qr_context: "Bar",
        rating: null,
        target_staff_member: null
      }
    });

    const normalized = normalizeTelegramText(message);

    expect(normalized).toContain("Yangi shikoyat");
    expect(normalized).toContain("Turi: Shikoyat");
    expect(normalized).toContain("Mavzular: Kutish");
    expect(normalized).toContain("Qayerdan: Bar");
  });

  it("formats neutral staff targets without requiring a staff member row", () => {
    const message = formatSubmissionNotificationText({
      locale: "RU",
      submission: {
        body_text: "Не понял, кто отвечал за заказ",
        customer_display_name: null,
        customer_contact_phone: null,
        kind: "COMPLAINT",
        metadata: {
          complaintCategoryIds: ["service"],
          staffTargetType: "unknown",
          wizardChoiceId: "issue"
        },
        organization: {
          name: "Coffee Place"
        },
        qr_context: null,
        rating: null,
        target_staff_member: null
      }
    });

    const normalized = normalizeTelegramText(message);

    expect(normalized).toContain("Кого касается: не указано");
  });

  it("formats staff snapshots after the staff member row is gone", () => {
    const message = formatSubmissionNotificationText({
      locale: "RU",
      submission: {
        body_text: "Спасибо за помощь",
        customer_display_name: null,
        customer_contact_phone: null,
        kind: "REVIEW",
        metadata: {
          staffTargetSnapshot: {
            avatarUrl: null,
            displayName: "Aziza",
            id: "staff_1",
            roleTitle: "Бариста"
          },
          staffTargetType: "employee",
          wizardChoiceId: "great"
        },
        organization: {
          name: "Coffee Place"
        },
        qr_context: null,
        rating: 5,
        target_staff_member: null
      }
    });

    const normalized = normalizeTelegramText(message);

    expect(normalized).toContain("Кого касается: Aziza · Бариста");
  });

  it("keeps media captions inside the requested limit", () => {
    const message = formatSubmissionNotificationText({
      locale: "RU",
      maxLength: 1000,
      submission: {
        body_text: "a".repeat(4000),
        customer_display_name: null,
        customer_contact_phone: null,
        kind: "SUGGESTION",
        metadata: {
          suggestionTopicIds: ["service"],
          wizardChoiceId: "idea"
        },
        organization: {
          name: "Coffee Place"
        },
        qr_context: null,
        rating: null,
        target_staff_member: null
      }
    });

    expect(message.length).toBeLessThanOrEqual(1000);
    expect(normalizeTelegramText(message)).toContain("Новое предложение");
  });
});
