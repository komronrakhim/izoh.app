export const MEDIA_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SUBMISSION_PHOTO_LIMIT = 4;
export const MEDIA_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const SUBMISSION_PHOTO_MAX_BYTES = MEDIA_IMAGE_MAX_BYTES;
export const LOGO_MAX_BYTES = MEDIA_IMAGE_MAX_BYTES;

export type MediaImageContentType = (typeof MEDIA_IMAGE_CONTENT_TYPES)[number];

export type BrowserMediaAssetKind =
  | "MENU_ITEM_PHOTO"
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

type ImageUploadKind = UploadImageAssetInput["kind"];

export const isSupportedImageContentType = (value: string): value is MediaImageContentType =>
  MEDIA_IMAGE_CONTENT_TYPES.includes(value as MediaImageContentType);

export const getMediaImageSizeLimit = (kind: UploadImageAssetInput["kind"]) =>
  MEDIA_IMAGE_MAX_BYTES;

const uploadImageOptimizationByKind = {
  ORGANIZATION_LOGO: {
    maxDimension: 800,
    mimeType: "image/webp",
    quality: 0.9,
    skipBelowBytes: 180 * 1024
  },
  MENU_ITEM_PHOTO: {
    maxDimension: 1200,
    mimeType: "image/jpeg",
    quality: 0.84,
    skipBelowBytes: 320 * 1024
  },
  STAFF_AVATAR: {
    maxDimension: 800,
    mimeType: "image/jpeg",
    quality: 0.86,
    skipBelowBytes: 220 * 1024
  },
  SUBMISSION_PHOTO: {
    maxDimension: 1600,
    mimeType: "image/jpeg",
    quality: 0.82,
    skipBelowBytes: 480 * 1024
  }
} as const satisfies Record<
  ImageUploadKind,
  {
    maxDimension: number;
    mimeType: "image/jpeg" | "image/webp";
    quality: number;
    skipBelowBytes: number;
  }
>;

const getOptimizedFileName = (fileName: string, mimeType: string) => {
  const extension = mimeType === "image/webp" ? "webp" : mimeType === "image/png" ? "png" : "jpg";
  const cleanName = fileName.trim() || `image.${extension}`;
  const baseName = cleanName.replace(/\.[^.]+$/u, "");

  return `${baseName || "image"}.${extension}`;
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: "image/jpeg" | "image/webp",
  quality: number
) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });

const loadImageElement = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be decoded."));
    };
    image.src = url;
  });

const decodeUploadImage = async (file: File) => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image"
      });

      return {
        close: () => bitmap.close(),
        height: bitmap.height,
        image: bitmap,
        width: bitmap.width
      };
    } catch {
      // Fall back to HTMLImageElement for older Telegram WebView implementations.
    }
  }

  const image = await loadImageElement(file);

  return {
    close: () => undefined,
    height: image.naturalHeight || image.height,
    image,
    width: image.naturalWidth || image.width
  };
};

export const optimizeImageFileForUpload = async (file: File, kind: ImageUploadKind) => {
  if (typeof document === "undefined" || !isSupportedImageContentType(file.type)) {
    return file;
  }

  const settings = uploadImageOptimizationByKind[kind];

  if (file.size <= settings.skipBelowBytes) {
    return file;
  }

  try {
    const decoded = await decodeUploadImage(file);
    const largestSide = Math.max(decoded.width, decoded.height);

    if (!decoded.width || !decoded.height) {
      decoded.close();
      return file;
    }

    const scale = Math.min(1, settings.maxDimension / largestSide);
    const targetWidth = Math.max(1, Math.round(decoded.width * scale));
    const targetHeight = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d", {
      alpha: settings.mimeType !== "image/jpeg"
    });

    if (!context) {
      decoded.close();
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    if (settings.mimeType === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, targetWidth, targetHeight);
    }

    context.drawImage(decoded.image, 0, 0, targetWidth, targetHeight);
    decoded.close();

    const blob = await canvasToBlob(canvas, settings.mimeType, settings.quality);

    if (!blob || blob.size <= 0) {
      return file;
    }

    if (scale === 1 && blob.size >= file.size * 0.92) {
      return file;
    }

    return new File([blob], getOptimizedFileName(file.name, blob.type || settings.mimeType), {
      lastModified: file.lastModified,
      type: blob.type || settings.mimeType
    });
  } catch {
    return file;
  }
};

const createMediaHeaders = (initDataRaw?: string, headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers);

  if (initDataRaw) {
    nextHeaders.set("X-Telegram-Init-Data", initDataRaw);
  }

  return nextHeaders;
};

const createDirectMediaUploadUrl = ({
  fileName,
  kind,
  ownerId,
  ownerType
}: {
  fileName: string;
  kind: ImageUploadKind;
  ownerId: string;
  ownerType: BrowserMediaOwnerType;
}) => {
  const params = new URLSearchParams({
    fileName,
    kind,
    ownerId,
    ownerType
  });

  return `/api/media/uploads/direct?${params.toString()}`;
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

  const uploadFile = await optimizeImageFileForUpload(file, kind);

  if (uploadFile.size > sizeLimit) {
    throw new Error("Image is too large.");
  }

  const directResponse = await fetch(
    createDirectMediaUploadUrl({
      fileName: uploadFile.name,
      kind,
      ownerId,
      ownerType
    }),
    {
      body: uploadFile,
      headers: createMediaHeaders(initDataRaw, {
        "Content-Type": uploadFile.type
      }),
      method: "POST"
    }
  );

  if (!directResponse.ok) {
    throw new Error("Direct upload failed.");
  }

  return ((await directResponse.json()) as MediaFinalizeResponse).assets;
};
