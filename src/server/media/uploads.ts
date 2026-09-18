import type {
  MediaAssetKind,
  MediaOwnerType,
  Prisma
} from "../../../prisma/generated/prisma/client";

import { getDomainDb, type DomainDb } from "~/server/domain/shared";
import { MEDIA_IMAGE_MAX_BYTES, isSupportedImageContentType } from "./constants";
import { buildFinalStorageKey } from "./keys";
import {
  LOCAL_MEDIA_BUCKET,
  putLocalMediaObject,
  shouldUseLocalMediaStorage
} from "./local-storage";
import { getR2Config, putR2Object } from "./r2-client";
import {
  getMediaChecksum,
  processLogoImage,
  processSubmissionPhoto,
  type ProcessedImage
} from "./processing";

type CreateDirectMediaUploadInput = {
  body: Uint8Array;
  contentType: string;
  fileName: string;
  kind: MediaAssetKind;
  ownerId: string;
  ownerType: MediaOwnerType;
  userId?: string;
};

const getSizeLimitBytes = () => MEDIA_IMAGE_MAX_BYTES;

const assertUploadKindIsImage = (kind: MediaAssetKind) => {
  if (kind !== "ORGANIZATION_LOGO" && kind !== "STAFF_AVATAR" && kind !== "SUBMISSION_PHOTO") {
    throw new Error("This media kind cannot be uploaded through the image upload flow.");
  }
};

const createAssetRecordInput = ({
  asset,
  bucket,
  kind,
  ownerId,
  ownerType,
  publicUrl,
  storageKey
}: {
  asset: ProcessedImage;
  bucket: string;
  kind: MediaAssetKind;
  ownerId: string;
  ownerType: MediaOwnerType;
  publicUrl: string;
  storageKey: string;
}): Prisma.MediaAssetCreateManyInput => ({
  bucket,
  checksum: getMediaChecksum(asset.body),
  content_type: asset.contentType,
  height: asset.height,
  kind,
  metadata: {},
  owner_id: ownerId,
  owner_type: ownerType,
  public_url: publicUrl,
  size_bytes: asset.sizeBytes,
  status: "READY",
  storage_key: storageKey,
  width: asset.width
});

const createFinalMediaAssetInputs = async ({
  body,
  bucket,
  kind,
  ownerId,
  ownerType
}: {
  body: Uint8Array;
  bucket: string;
  kind: MediaAssetKind;
  ownerId: string;
  ownerType: MediaOwnerType;
}) => {
  const useLocalStorage = bucket === LOCAL_MEDIA_BUCKET;
  const finalAssets: Prisma.MediaAssetCreateManyInput[] = [];

  if (kind === "SUBMISSION_PHOTO") {
    const processed = await processSubmissionPhoto(body);
    const mainKey = buildFinalStorageKey({
      extension: processed.main.extension,
      kind: "SUBMISSION_PHOTO",
      ownerId,
      ownerType,
      variant: "main"
    });
    const thumbnailKey = buildFinalStorageKey({
      extension: processed.thumbnail.extension,
      kind: "SUBMISSION_THUMBNAIL",
      ownerId,
      ownerType,
      variant: "thumb"
    });
    const [mainObject, thumbnailObject] = await Promise.all([
      useLocalStorage
        ? putLocalMediaObject({
            body: processed.main.body,
            contentType: processed.main.contentType,
            key: mainKey
          })
        : putR2Object({
            body: processed.main.body,
            contentType: processed.main.contentType,
            key: mainKey
          }),
      useLocalStorage
        ? putLocalMediaObject({
            body: processed.thumbnail.body,
            contentType: processed.thumbnail.contentType,
            key: thumbnailKey
          })
        : putR2Object({
            body: processed.thumbnail.body,
            contentType: processed.thumbnail.contentType,
            key: thumbnailKey
          })
    ]);

    finalAssets.push(
      createAssetRecordInput({
        asset: processed.main,
        bucket: mainObject.bucket,
        kind: "SUBMISSION_PHOTO",
        ownerId,
        ownerType,
        publicUrl: mainObject.publicUrl,
        storageKey: mainObject.storageKey
      }),
      createAssetRecordInput({
        asset: processed.thumbnail,
        bucket: thumbnailObject.bucket,
        kind: "SUBMISSION_THUMBNAIL",
        ownerId,
        ownerType,
        publicUrl: thumbnailObject.publicUrl,
        storageKey: thumbnailObject.storageKey
      })
    );

    return finalAssets;
  }

  const processed = await processLogoImage(body);
  const finalKey = buildFinalStorageKey({
    extension: processed.extension,
    kind,
    ownerId,
    ownerType
  });
  const finalObject = useLocalStorage
    ? await putLocalMediaObject({
        body: processed.body,
        contentType: processed.contentType,
        key: finalKey
      })
    : await putR2Object({
        body: processed.body,
        contentType: processed.contentType,
        key: finalKey
      });

  finalAssets.push(
    createAssetRecordInput({
      asset: processed,
      bucket: finalObject.bucket,
      kind,
      ownerId,
      ownerType,
      publicUrl: finalObject.publicUrl,
      storageKey: finalObject.storageKey
    })
  );

  return finalAssets;
};

export const createDirectMediaUpload = async (
  input: CreateDirectMediaUploadInput,
  db: DomainDb = getDomainDb()
) => {
  assertUploadKindIsImage(input.kind);

  if (!isSupportedImageContentType(input.contentType)) {
    throw new Error("Only JPEG, PNG, and WebP images are supported.");
  }

  const sizeBytes = input.body.byteLength;

  if (!sizeBytes || sizeBytes > getSizeLimitBytes()) {
    throw new Error("Uploaded file is empty or too large.");
  }

  const bucket = shouldUseLocalMediaStorage() ? LOCAL_MEDIA_BUCKET : getR2Config().bucket;
  const finalAssets = await createFinalMediaAssetInputs({
    body: input.body,
    bucket,
    kind: input.kind,
    ownerId: input.ownerId,
    ownerType: input.ownerType
  });
  const storageKeys = finalAssets.map((asset) => asset.storage_key);

  return db.$transaction(async (tx) => {
    await tx.mediaAsset.createMany({
      data: finalAssets
    });

    return tx.mediaAsset.findMany({
      orderBy: {
        created_at: "asc"
      },
      where: {
        storage_key: {
          in: storageKeys
        }
      }
    });
  });
};
