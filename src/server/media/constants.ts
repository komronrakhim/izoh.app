export {
  LOGO_MAX_BYTES,
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_IMAGE_CONTENT_TYPES,
  SUBMISSION_PHOTO_LIMIT,
  SUBMISSION_PHOTO_MAX_BYTES,
  type MediaImageContentType
} from "~/shared/media";

import { MEDIA_IMAGE_CONTENT_TYPES, type MediaImageContentType } from "~/shared/media";

export const isSupportedImageContentType = (value: string): value is MediaImageContentType =>
  MEDIA_IMAGE_CONTENT_TYPES.includes(value as MediaImageContentType);
