import { describe, expect, it } from "vitest";

import { formatSubmissionNotificationText } from "~/server/telegram";

const normalizeTelegramText = (value: string) => value.replace(/<[^>]+>/g, "");

describe("Telegram submission notifications", () => {
  it("formats a low review as an important Russian notification without changing its kind", () => {
    const message = formatSubmissionNotificationText({
      locale: "ru",
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

    expect(normalized).toContain("🏪 Coffee Place");
    expect(normalized).toContain("Низкая оценка");
    expect(normalized).toContain("🙁 Не очень");
    expect(normalized).not.toContain("2/5");
    expect(normalized).not.toContain("Тип:");
    expect(normalized).not.toContain("Сигнал:");
    expect(normalized).toContain("📍 Стол 4");
    expect(normalized).toContain("👤 Komron · Кассир");
    expect(normalized).toContain("Контакт гостя: @guest");
    expect(message).toContain("Кофе был холодный &lt;script&gt;");
  });

  it("formats complaint topics in the recipient locale", () => {
    const message = formatSubmissionNotificationText({
      locale: "uz",
      submission: {
        body_text: "Juda uzoq kutdik",
        customer_display_name: null,
        customer_contact_phone: null,
        kind: "COMPLAINT",
        metadata: {
          complaintCategoryIds: ["wait", "service", "quality", "cleanliness"],
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

    expect(normalized).toContain("🏪 Coffee Place");
    expect(normalized).toContain("Yangi shikoyat");
    expect(normalized).not.toContain("Turi:");
    expect(normalized).toContain("🏷 Kutish · Xizmat · Sifat · +1");
    expect(normalized).toContain("📍 Bar");
  });

  it("formats neutral staff targets without requiring a staff member row", () => {
    const message = formatSubmissionNotificationText({
      locale: "ru",
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

    expect(normalized).toContain("👤 Сотрудник не указан");
  });

  it("formats staff snapshots after the staff member row is gone", () => {
    const message = formatSubmissionNotificationText({
      locale: "ru",
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
        target_staff_member: {
          display_name: "Хадича",
          role_title: "Бариста"
        }
      }
    });

    const normalized = normalizeTelegramText(message);

    expect(normalized).toContain("⭐ Новый отзыв · 😍 Отлично");
    expect(normalized).toContain("👤 Aziza · Бариста");
  });

  it("keeps media captions inside the requested limit", () => {
    const message = formatSubmissionNotificationText({
      locale: "ru",
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
