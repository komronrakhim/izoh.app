export const MEDIA_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SUBMISSION_PHOTO_LIMIT = 4;
export const MEDIA_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const SUBMISSION_PHOTO_MAX_BYTES = MEDIA_IMAGE_MAX_BYTES;
export const LOGO_MAX_BYTES = MEDIA_IMAGE_MAX_BYTES;

export type MediaImageContentType = (typeof MEDIA_IMAGE_CONTENT_TYPES)[number];

export type BrowserMediaAssetKind =
  | "ORGANIZATION_LOGO"
  | "STAFF_AVATAR"
  | "SUBMISSION_PHOTO"
  | "SUBMISSION_THUMBNAIL";

export type BrowserMediaOwnerType = "ORGANIZATION" | "STAFF_MEMBER" | "SUBMISSION" | "USER";

export type FinalizedMediaAsset = {
  id: string;
  kind: BrowserMediaAssetKind;
  public_url: string;
};

type MediaUploadSessionResponse = {
  headers: Record<string, string>;
  maxBytes: number;
  method: "PUT";
  session: {
    id: string;
  };
  uploadUrl: string;
};

type MediaFinalizeResponse = {
  assets: FinalizedMediaAsset[];
};

type UploadImageAssetInput = {
  file: File;
  initDataRaw?: string;
  kind: Exclude<BrowserMediaAssetKind, "SUBMISSION_THUMBNAIL">;
  ownerId: string;
  ownerType: BrowserMediaOwnerType;
};

export const isSupportedImageContentType = (value: string): value is MediaImageContentType =>
  MEDIA_IMAGE_CONTENT_TYPES.includes(value as MediaImageContentType);

export const getMediaImageSizeLimit = (kind: UploadImageAssetInput["kind"]) =>
  MEDIA_IMAGE_MAX_BYTES;

const createMediaHeaders = (initDataRaw?: string, headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers);

  if (initDataRaw) {
    nextHeaders.set("X-Telegram-Init-Data", initDataRaw);
  }

  return nextHeaders;
};

export const uploadImageAsset = async ({
  file,
  initDataRaw,
  kind,
  ownerId,
  ownerType
}: UploadImageAssetInput) => {
  if (!isSupportedImageContentType(file.type)) {
    throw new Error("Unsupported image type.");
  }

  const sizeLimit = getMediaImageSizeLimit(kind);

  if (file.size > sizeLimit) {
    throw new Error("Image is too large.");
  }

  const sessionResponse = await fetch("/api/media/upload-sessions", {
    body: JSON.stringify({
      contentType: file.type,
      fileName: file.name,
      kind,
      ownerId,
      ownerType
    }),
    headers: createMediaHeaders(initDataRaw, {
      "Content-Type": "application/json"
    }),
    method: "POST"
  });

  if (!sessionResponse.ok) {
    throw new Error("Upload session failed.");
  }

  const uploadSession = (await sessionResponse.json()) as MediaUploadSessionResponse;

  if (file.size > uploadSession.maxBytes) {
    throw new Error("Image is too large.");
  }

  const uploadResponse = await fetch(uploadSession.uploadUrl, {
    body: file,
    headers: uploadSession.headers,
    method: uploadSession.method
  });

  if (!uploadResponse.ok) {
    throw new Error("Direct upload failed.");
  }

  const finalizeResponse = await fetch(
    `/api/media/upload-sessions/${uploadSession.session.id}/finalize`,
    {
      headers: createMediaHeaders(initDataRaw),
      method: "POST"
    }
  );

  if (!finalizeResponse.ok) {
    throw new Error("Upload finalization failed.");
  }

  return ((await finalizeResponse.json()) as MediaFinalizeResponse).assets;
};
