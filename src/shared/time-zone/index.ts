export const FALLBACK_TIME_ZONE = "UTC";
export const TIME_ZONE_MAX_LENGTH = 80;

export const isValidTimeZone = (value: string) => {
  const timeZone = value.trim();

  if (!timeZone || timeZone.length > TIME_ZONE_MAX_LENGTH) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone
    }).format(new Date(0));

    return true;
  } catch {
    return false;
  }
};

export const normalizeTimeZone = (value?: null | string) => {
  const timeZone = value?.trim();

  if (!timeZone || !isValidTimeZone(timeZone)) {
    return FALLBACK_TIME_ZONE;
  }

  return timeZone;
};

export const getBrowserTimeZone = () => {
  try {
    return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return FALLBACK_TIME_ZONE;
  }
};
