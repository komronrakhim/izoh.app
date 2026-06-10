import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getRequiredEnv } from "~/server/config/env";

let r2Client: S3Client | null = null;

export const getR2Config = () => ({
  accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
  accountId: getRequiredEnv("R2_ACCOUNT_ID"),
  bucket: getRequiredEnv("R2_BUCKET"),
  publicBaseUrl: getRequiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/g, ""),
  secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY")
});

export const getR2Client = () => {
  const config = getR2Config();

  if (!r2Client) {
    r2Client = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      region: "auto"
    });
  }

  return r2Client;
};

export const createPresignedPutUrl = async ({
  contentType,
  expiresIn,
  key
}: {
  contentType: string;
  expiresIn: number;
  key: string;
}) => {
  const config = getR2Config();

  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: config.bucket,
      ContentType: contentType,
      Key: key
    }),
    {
      expiresIn
    }
  );
};

export const headR2Object = async (key: string) => {
  const config = getR2Config();

  return getR2Client().send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key
    })
  );
};

export const getR2Object = async (key: string) => {
  const config = getR2Config();

  return getR2Client().send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key
    })
  );
};

export const putR2Object = async ({
  body,
  contentType,
  key
}: {
  body: Uint8Array;
  contentType: string;
  key: string;
}) => {
  const config = getR2Config();

  await getR2Client().send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucket,
      CacheControl: "public, max-age=31536000, immutable",
      ContentType: contentType,
      Key: key
    })
  );

  return {
    bucket: config.bucket,
    publicUrl: `${config.publicBaseUrl}/${key}`,
    storageKey: key
  };
};

export const deleteR2Object = async (key: string) => {
  const config = getR2Config();

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key
    })
  );
};
