import { randomBytes } from "node:crypto";

import { type DomainDb, getDomainDb } from "~/server/domain/shared";
import { normalizeGuestContext } from "~/server/domain/guest-entry-payload";

const GUEST_CONTEXT_CODE_ALPHABET = "23456789abcdefghijkmnopqrstuvwxyz";
const GUEST_CONTEXT_CODE_LENGTH = 5;
const GUEST_CONTEXT_CODE_ATTEMPTS = 12;

const createGuestContextCode = () => {
  const bytes = randomBytes(GUEST_CONTEXT_CODE_LENGTH);

  return Array.from(bytes)
    .map((byte) => GUEST_CONTEXT_CODE_ALPHABET[byte % GUEST_CONTEXT_CODE_ALPHABET.length])
    .join("");
};

export const getOrCreateOrganizationGuestContext = async (
  {
    label,
    organizationId
  }: {
    label: string;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) => {
  const normalizedLabel = normalizeGuestContext(label);

  if (!normalizedLabel) {
    return null;
  }

  const existingByLabel = await db.organizationGuestContext.findFirst({
    select: {
      code: true,
      id: true,
      label: true
    },
    where: {
      label: normalizedLabel,
      organization_id: organizationId
    }
  });

  if (existingByLabel) {
    return existingByLabel;
  }

  for (let attempt = 0; attempt < GUEST_CONTEXT_CODE_ATTEMPTS; attempt += 1) {
    const code = createGuestContextCode();
    const existingByCode = await db.organizationGuestContext.findFirst({
      select: {
        id: true
      },
      where: {
        code,
        organization_id: organizationId
      }
    });

    if (existingByCode) {
      continue;
    }

    return db.organizationGuestContext.create({
      data: {
        code,
        label: normalizedLabel,
        organization_id: organizationId
      },
      select: {
        code: true,
        id: true,
        label: true
      }
    });
  }

  throw new Error("Guest context code is unavailable.");
};

export const getOrganizationGuestContextByCode = async (
  {
    code,
    organizationId
  }: {
    code: string;
    organizationId: string;
  },
  db: DomainDb = getDomainDb()
) =>
  db.organizationGuestContext.findFirst({
    select: {
      code: true,
      id: true,
      label: true
    },
    where: {
      code,
      organization_id: organizationId
    }
  });
