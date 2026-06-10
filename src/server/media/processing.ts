import { createHash } from "node:crypto";
import sharp from "sharp";

export type ProcessedImage = {
  body: Buffer;
  contentType: "image/jpeg" | "image/webp";
  extension: "jpg" | "webp";
  height: number;
  sizeBytes: number;
  width: number;
};

const sha256 = (body: Uint8Array) => createHash("sha256").update(body).digest("base64url");

export const getMediaChecksum = sha256;

export const processSubmissionPhoto = async (input: Uint8Array) => {
  const main = await sharp(input, {
    limitInputPixels: 24_000_000
  })
    .rotate()
    .resize({
      fit: "inside",
      height: 1600,
      withoutEnlargement: true,
      width: 1600
    })
    .jpeg({
      mozjpeg: true,
      quality: 82
    })
    .toBuffer({
      resolveWithObject: true
    });

  const thumbnail = await sharp(input, {
    limitInputPixels: 24_000_000
  })
    .rotate()
    .resize({
      fit: "cover",
      height: 360,
      width: 360
    })
    .jpeg({
      mozjpeg: true,
      quality: 76
    })
    .toBuffer({
      resolveWithObject: true
    });

  return {
    main: {
      body: main.data,
      contentType: "image/jpeg",
      extension: "jpg",
      height: main.info.height,
      sizeBytes: main.data.byteLength,
      width: main.info.width
    } satisfies ProcessedImage,
    thumbnail: {
      body: thumbnail.data,
      contentType: "image/jpeg",
      extension: "jpg",
      height: thumbnail.info.height,
      sizeBytes: thumbnail.data.byteLength,
      width: thumbnail.info.width
    } satisfies ProcessedImage
  };
};

export const processLogoImage = async (input: Uint8Array) => {
  const metadata = await sharp(input).metadata();
  const hasAlpha = Boolean(metadata.hasAlpha);
  const pipeline = sharp(input, {
    limitInputPixels: 16_000_000
  })
    .rotate()
    .resize({
      fit: "inside",
      height: 800,
      withoutEnlargement: true,
      width: 800
    });

  const output = hasAlpha
    ? await pipeline
        .webp({
          effort: 4,
          lossless: true
        })
        .toBuffer({
          resolveWithObject: true
        })
    : await pipeline
        .jpeg({
          mozjpeg: true,
          quality: 88
        })
        .toBuffer({
          resolveWithObject: true
        });

  return {
    body: output.data,
    contentType: hasAlpha ? "image/webp" : "image/jpeg",
    extension: hasAlpha ? "webp" : "jpg",
    height: output.info.height,
    sizeBytes: output.data.byteLength,
    width: output.info.width
  } satisfies ProcessedImage;
};

export const streamToBuffer = async (stream: unknown) => {
  if (
    !stream ||
    typeof (stream as { transformToByteArray?: unknown }).transformToByteArray !== "function"
  ) {
    throw new Error("R2 object body is not readable.");
  }

  const bytes = await (
    stream as { transformToByteArray: () => Promise<Uint8Array> }
  ).transformToByteArray();

  return Buffer.from(bytes);
};
