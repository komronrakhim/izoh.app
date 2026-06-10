export type GuestEntryStartPayload = {
  contextCode?: string;
  organizationRef: string;
};

const GUEST_CONTEXT_MAX_LENGTH = 80;
const START_PARAM_SEPARATOR = "__";
const CONTEXT_CODE_PATTERN = /^[a-z0-9]{4,12}$/;

export const normalizeGuestContext = (value: null | string | undefined) => {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, GUEST_CONTEXT_MAX_LENGTH);
};

export const isGuestContextCode = (value: string) => CONTEXT_CODE_PATTERN.test(value);

export const createGuestEntryStartParam = ({
  contextCode,
  organizationRef
}: {
  contextCode?: string;
  organizationRef: string;
}) => {
  const normalizedOrganizationRef = organizationRef.trim();

  if (!normalizedOrganizationRef) {
    throw new Error("Guest entry organization reference is required.");
  }

  if (!contextCode) {
    return normalizedOrganizationRef;
  }

  if (!isGuestContextCode(contextCode)) {
    throw new Error("Guest entry context code is invalid.");
  }

  return `${normalizedOrganizationRef}${START_PARAM_SEPARATOR}${contextCode}`;
};

export const parseGuestEntryStartParam = (startParam: string): GuestEntryStartPayload => {
  const normalized = startParam.trim();

  if (!normalized) {
    throw new Error("Guest entry payload is empty.");
  }

  const parts = normalized.split(START_PARAM_SEPARATOR);

  if (parts.length > 2 || !parts[0]) {
    throw new Error("Guest entry payload is incomplete.");
  }

  const contextCode = parts[1];

  if (contextCode && !isGuestContextCode(contextCode)) {
    throw new Error("Guest entry context code is invalid.");
  }

  return {
    contextCode,
    organizationRef: parts[0]
  };
};
