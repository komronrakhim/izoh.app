import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { getOptionalEnv } from "~/server/config/env";
import { sanitizeStorageSegment } from "./keys";

export const LOCAL_MEDIA_BUCKET = "local-dev";

const requiredR2Keys = [
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
  "R2_SECRET_ACCESS_KEY"
];

const rootDir = resolve(process.cwd(), ".tmp", "izoh-media");

const getLocalMediaPath = (key: string) =>
  join(rootDir, ...key.split("/").map((segment) => sanitizeStorageSegment(segment)));

const getLocalMediaMetaPath = (key: string) => `${getLocalMediaPath(key)}.json`;

const readMeta = async (key: string): Promise<{ contentType?: string }> => {
  try {
    return JSON.parse(await readFile(getLocalMediaMetaPath(key), "utf8")) as {
      contentType?: string;
    };
  } catch {
    return {};
  }
};

export const shouldUseLocalMediaStorage = () =>
  process.env.NODE_ENV !== "production" && requiredR2Keys.some((key) => !getOptionalEnv(key));

export const getLocalPublicUrl = (key: string) =>
  `/api/media/local-assets?key=${encodeURIComponent(key)}`;

export const putLocalMediaObject = async ({
  body,
  contentType,
  key
}: {
  body: Uint8Array;
  contentType: string;
  key: string;
}) => {
  const filePath = getLocalMediaPath(key);

  await mkdir(dirname(filePath), {
    recursive: true
  });
  await writeFile(filePath, body);
  await writeFile(
    getLocalMediaMetaPath(key),
    JSON.stringify({
      contentType
    })
  );

  return {
    bucket: LOCAL_MEDIA_BUCKET,
    publicUrl: getLocalPublicUrl(key),
    storageKey: key
  };
};

export const headLocalMediaObject = async (key: string) => {
  const [fileStat, meta] = await Promise.all([stat(getLocalMediaPath(key)), readMeta(key)]);

  return {
    ContentLength: fileStat.size,
    ContentType: meta.contentType
  };
};

export const getLocalMediaObjectBuffer = async (key: string) => readFile(getLocalMediaPath(key));

export const deleteLocalMediaObject = async (key: string) => {
  await Promise.all([
    rm(getLocalMediaPath(key), {
      force: true
    }),
    rm(getLocalMediaMetaPath(key), {
      force: true
    })
  ]);
};
