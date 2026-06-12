export const ratingOptions = [
  {
    emoji: "😡",
    value: 1
  },
  {
    emoji: "🙁",
    value: 2
  },
  {
    emoji: "😐",
    value: 3
  },
  {
    emoji: "🙂",
    value: 4
  },
  {
    emoji: "😍",
    value: 5
  }
] as const;

export type RatingValue = (typeof ratingOptions)[number]["value"];

export const normalizeRatingValue = (rating: number): RatingValue =>
  Math.max(1, Math.min(5, Math.round(rating))) as RatingValue;

export const getRatingEmoji = (rating: number) =>
  ratingOptions.find((option) => option.value === normalizeRatingValue(rating))?.emoji ??
  ratingOptions[4].emoji;

export const getRatingLabelKey = (rating: number) =>
  `customer.wizard.rating.labels.${normalizeRatingValue(rating)}` as const;
