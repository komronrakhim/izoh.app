import { randomBytes } from "node:crypto";

type MediaOwnerType = "ORGANIZATION" | "STAFF_MEMBER" | "SUBMISSION" | "USER";

type MediaAssetKind =
  | "MENU_ITEM_PHOTO"
  | "ORGANIZATION_LOGO"
  | "STAFF_AVATAR"
  | "SUBMISSION_PHOTO"
  | "SUBMISSION_THUMBNAIL";

const randomSegment = () => randomBytes(12).toString("base64url");

export const sanitizeStorageSegment = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";

export const buildFinalStorageKey = ({
  extension,
  kind,
  ownerId,
  ownerType,
  variant = "main"
}: {
  extension: "jpg" | "webp";
  kind: MediaAssetKind;
  ownerId: string;
  ownerType: MediaOwnerType;
  variant?: string;
}) => {
  const safeOwnerId = sanitizeStorageSegment(ownerId);
  const suffix = `${Date.now()}-${randomSegment()}.${extension}`;

  if (kind === "ORGANIZATION_LOGO") {
    return `org/${safeOwnerId}/logo/${suffix}`;
  }

  if (kind === "MENU_ITEM_PHOTO") {
    return `org/${safeOwnerId}/menu/${suffix}`;
  }

  if (kind === "STAFF_AVATAR") {
    return `staff/${safeOwnerId}/avatar/${suffix}`;
  }

  if (kind === "SUBMISSION_THUMBNAIL") {
    return `submission/${safeOwnerId}/photo/thumb-${suffix}`;
  }

  if (kind === "SUBMISSION_PHOTO") {
    return `submission/${safeOwnerId}/photo/${variant}-${suffix}`;
  }

  return `${ownerType.toLowerCase()}/${safeOwnerId}/${suffix}`;
};
