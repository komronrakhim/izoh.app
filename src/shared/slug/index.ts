const cyrillicToLatinMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  ғ: "g",
  қ: "q",
  ў: "o",
  ҳ: "h"
};

export const transliterateCyrillic = (value: string) =>
  value.replace(/[а-яёғқўҳ]/gi, (char) => {
    const lower = char.toLowerCase();

    return cyrillicToLatinMap[lower] ?? char;
  });

export const createReadableSlug = (
  value: string,
  {
    fallback = "",
    maxLength = 64
  }: {
    fallback?: string;
    maxLength?: number;
  } = {}
) => {
  const slug = transliterateCyrillic(value)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, maxLength)
    .replace(/(^-|-$)/g, "");

  return slug || fallback;
};
