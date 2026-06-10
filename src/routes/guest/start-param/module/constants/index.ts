import type { GuestEntryChannelId } from "~/shared/guest-entry";

import type { WizardChoiceId } from "../types";

export const choiceToneClassNames = {
  great: "bg-[#FFB000] text-white",
  idea: "bg-[#34C759] text-white",
  issue: "bg-[#FF2D55] text-white",
  ok: "bg-[#2AABEE] text-white"
} as const satisfies Record<WizardChoiceId, string>;

export const choiceAccentColors = {
  great: "#FFB000",
  idea: "#34C759",
  issue: "#FF2D55",
  ok: "#2AABEE"
} as const satisfies Record<WizardChoiceId, string>;

export const choiceAmbientEmojis = {
  great: ["✨", "👏", "💛"],
  idea: ["📝", "✨", "🚀"],
  issue: ["💬", "🧯", "⚠️"],
  ok: ["👌", "💬", "🫶"]
} as const satisfies Record<WizardChoiceId, readonly string[]>;

const topicEmojiByChannel = {
  complaint: {
    cleanliness: "🫧",
    conditions: "🏠",
    other: "💬",
    payment: "💳",
    quality: "✨",
    service: "🤝",
    wait: "⏱️"
  },
  suggestion: {
    comfort: "🛋️",
    events: "🎉",
    other: "💡",
    price: "🏷️",
    product: "🎁",
    service: "🤝",
    speed: "⚡️"
  }
} as const;

export const getTopicEmoji = (channelId: GuestEntryChannelId, topicId: string) => {
  if (channelId !== "complaint" && channelId !== "suggestion") {
    return "💬";
  }

  const emojis = topicEmojiByChannel[channelId] as Record<string, string>;

  return emojis[topicId] ?? "💬";
};

export const stepTransition = {
  animate: {
    opacity: 1,
    scale: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    scale: 0.992,
    y: -6
  },
  initial: {
    opacity: 0,
    scale: 0.992,
    y: 8
  },
  transition: {
    duration: 0.24,
    ease: [0.22, 1, 0.36, 1]
  }
} as const;

export const doneTransition = {
  icon: {
    duration: 0.34,
    ease: [0.2, 1.28, 0.34, 1]
  },
  text: {
    delay: 0.06,
    duration: 0.24,
    ease: [0.22, 1, 0.36, 1]
  }
} as const;

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

type RatingScenePosition = {
  delay: number;
  floatX: number;
  floatY: number;
  opacity: number;
  rotate: number;
  size: number;
  x: number;
  y: number;
};

type RatingConfettiPosition = {
  delay: number;
  rotate: number;
  size: number;
  x: number;
  y: number;
};

const ratingSceneEmojiSets: Record<RatingValue, string[]> = {
  1: ["😤", "💢", "😠", "🙈", "🫠", "😣", "⚡️", "😬", "🧯", "💭"],
  2: ["🫤", "😕", "💭", "😮‍💨", "🤔", "😬", "🌧️", "🧩", "🙃", "🥲"],
  3: ["🙂", "👌", "💬", "🤔", "🫶", "☕️", "✨", "🙃", "👍", "💭"],
  4: ["😊", "👏", "✨", "👍", "💛", "😌", "🌟", "🙌", "🫶", "💬"],
  5: ["🥰", "🤩", "✨", "💛", "🌟", "👏", "🎉", "🫶", "🙌", "💫"]
};

export const ratingScenePositions: RatingScenePosition[] = [
  { delay: 0.02, floatX: 2, floatY: -3, opacity: 0.34, rotate: -13, size: 30, x: 50, y: 8 },
  { delay: 0.06, floatX: -3, floatY: 2, opacity: 0.3, rotate: 12, size: 24, x: 71, y: 16 },
  { delay: 0.1, floatX: -2, floatY: -3, opacity: 0.38, rotate: 18, size: 38, x: 88, y: 33 },
  { delay: 0.14, floatX: 3, floatY: 2, opacity: 0.24, rotate: -9, size: 20, x: 85, y: 65 },
  { delay: 0.18, floatX: -2, floatY: 3, opacity: 0.34, rotate: 14, size: 34, x: 69, y: 83 },
  { delay: 0.22, floatX: 2, floatY: -2, opacity: 0.26, rotate: -16, size: 22, x: 50, y: 92 },
  { delay: 0.26, floatX: 3, floatY: 2, opacity: 0.36, rotate: 11, size: 40, x: 29, y: 83 },
  { delay: 0.3, floatX: -2, floatY: -3, opacity: 0.24, rotate: -18, size: 21, x: 15, y: 64 },
  { delay: 0.34, floatX: 2, floatY: 3, opacity: 0.35, rotate: 15, size: 32, x: 12, y: 34 },
  { delay: 0.38, floatX: -3, floatY: -2, opacity: 0.27, rotate: -11, size: 23, x: 29, y: 16 }
];

export const ratingConfettiPositions: RatingConfettiPosition[] = [
  { delay: 0, rotate: -18, size: 22, x: -74, y: -44 },
  { delay: 0.015, rotate: 16, size: 18, x: 72, y: -50 },
  { delay: 0.03, rotate: 24, size: 20, x: -98, y: 2 },
  { delay: 0.045, rotate: -24, size: 17, x: 94, y: 6 },
  { delay: 0.06, rotate: 12, size: 19, x: -56, y: 54 },
  { delay: 0.075, rotate: -15, size: 21, x: 54, y: 56 },
  { delay: 0.09, rotate: 8, size: 16, x: 0, y: -72 }
];

export const getRatingSceneEmojis = (value: number) =>
  ratingSceneEmojiSets[value as RatingValue] ?? ratingSceneEmojiSets[5];

export const supportedPhotoContentTypes = ["image/jpeg", "image/png", "image/webp"];

export const TEAM_STAFF_TARGET_ID = "team";

export const UNKNOWN_STAFF_TARGET_ID = "__unknown_staff_target";
