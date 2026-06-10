import { describe, expect, it } from "vitest";

import { formatSubmissionNotificationText } from "~/server/telegram";

describe("Telegram submission notifications", () => {
  it("formats a low review as an important Russian notification without changing its kind", () => {
    const message = formatSubmissionNotificationText({
      locale: "RU",
      submission: {
        body_text: "Кофе был холодный <script>",
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

    expect(message).toContain("<b>Низкая оценка</b>");
    expect(message).toContain("Тип: Отзыв");
    expect(message).toContain("Оценка: <b>2/5</b>");
    expect(message).toContain("Сигнал: нужна внимательность");
    expect(message).toContain("Откуда: Стол 4");
    expect(message).toContain("Кого касается: Komron · Кассир");
    expect(message).toContain("Контакт: @guest");
    expect(message).toContain("Кофе был холодный &lt;script&gt;");
  });

  it("formats complaint topics in the recipient locale", () => {
    const message = formatSubmissionNotificationText({
      locale: "UZ",
      submission: {
        body_text: "Juda uzoq kutdik",
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

    expect(message).toContain("<b>Yangi shikoyat</b>");
    expect(message).toContain("Turi: Shikoyat");
    expect(message).toContain("Mavzular: Kutish");
    expect(message).toContain("Qayerdan: Bar");
  });

  it("formats neutral staff targets without requiring a staff member row", () => {
    const message = formatSubmissionNotificationText({
      locale: "RU",
      submission: {
        body_text: "Не понял, кто отвечал за заказ",
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

    expect(message).toContain("Кого касается: не указано");
  });

  it("formats staff snapshots after the staff member row is gone", () => {
    const message = formatSubmissionNotificationText({
      locale: "RU",
      submission: {
        body_text: "Спасибо за помощь",
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

    expect(message).toContain("Кого касается: Aziza · Бариста");
  });

  it("keeps media captions inside the requested limit", () => {
    const message = formatSubmissionNotificationText({
      locale: "RU",
      maxLength: 1000,
      submission: {
        body_text: "a".repeat(4000),
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
    expect(message).toContain("<b>Новое предложение</b>");
  });
});
