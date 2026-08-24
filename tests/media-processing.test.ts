import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  createDirectMediaUpload,
  deleteLocalMediaObject,
  getLocalMediaObjectBuffer,
  processLogoImage,
  processMenuItemPhoto,
  processSubmissionPhoto
} from "~/server/media";

describe("media processing", () => {
  it("compresses submission photos without returning the original", async () => {
    const input = await sharp({
      create: {
        background: "#247c68",
        channels: 3,
        height: 1200,
        width: 1200
      }
    })
      .png()
      .toBuffer();

    const result = await processSubmissionPhoto(input);

    expect(result.main.contentType).toBe("image/jpeg");
    expect(result.thumbnail.contentType).toBe("image/jpeg");
    expect(result.thumbnail.width).toBe(360);
    expect(result.thumbnail.height).toBe(360);
    expect(result.main.body.equals(input)).toBe(false);
  });

  it("keeps logo transparency by using webp output", async () => {
    const input = await sharp({
      create: {
        background: { alpha: 0, b: 0, g: 0, r: 0 },
        channels: 4,
        height: 256,
        width: 256
      }
    })
      .png()
      .toBuffer();

    const result = await processLogoImage(input);

    expect(result.contentType).toBe("image/webp");
    expect(result.extension).toBe("webp");
  });

  it("normalizes menu item photos to a bounded JPEG", async () => {
    const input = await sharp({
      create: {
        background: { alpha: 0.5, b: 30, g: 120, r: 210 },
        channels: 4,
        height: 1800,
        width: 2400
      }
    })
      .png()
      .toBuffer();

    const result = await processMenuItemPhoto(input);

    expect(result.contentType).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
    expect(Math.max(result.width, result.height)).toBe(1200);
  });

  it("creates exactly one organization-owned menu photo asset", async () => {
    const input = await sharp({
      create: {
        background: "#d27c32",
        channels: 3,
        height: 720,
        width: 960
      }
    })
      .jpeg()
      .toBuffer();
    const records: Array<Record<string, unknown>> = [];
    const db = {
      $transaction: async (
        callback: (tx: {
          mediaAsset: {
            createMany: (input: { data: Array<Record<string, unknown>> }) => Promise<void>;
            findMany: () => Promise<Array<Record<string, unknown>>>;
          };
        }) => Promise<Array<Record<string, unknown>>>
      ) =>
        callback({
          mediaAsset: {
            createMany: async ({ data }) => {
              records.push(...data.map((item) => ({ ...item, id: "menu-photo-1" })));
            },
            findMany: async () => records
          }
        })
    };

    try {
      const assets = await createDirectMediaUpload(
        {
          body: input,
          contentType: "image/jpeg",
          fileName: "dish.jpg",
          kind: "MENU_ITEM_PHOTO",
          ownerId: "org-menu-photo-test",
          ownerType: "ORGANIZATION"
        },
        db as never
      );

      expect(assets).toHaveLength(1);
      expect(assets[0]).toMatchObject({
        kind: "MENU_ITEM_PHOTO",
        owner_id: "org-menu-photo-test",
        owner_type: "ORGANIZATION",
        status: "READY"
      });
      expect(String(assets[0]?.storage_key)).toMatch(/^org\/org-menu-photo-test\/menu\//);
    } finally {
      await Promise.all(
        records.map((record) =>
          typeof record.storage_key === "string"
            ? deleteLocalMediaObject(record.storage_key)
            : Promise.resolve()
        )
      );
    }
  });

  it("creates final media assets directly without an upload session", async () => {
    const input = await sharp({
      create: {
        background: "#6817ff",
        channels: 3,
        height: 900,
        width: 1200
      }
    })
      .jpeg()
      .toBuffer();
    const records: Array<Record<string, unknown>> = [];
    const db = {
      $transaction: async (
        callback: (tx: {
          mediaAsset: {
            createMany: (input: { data: Array<Record<string, unknown>> }) => Promise<void>;
            findMany: (input: {
              where: { storage_key: { in: unknown[] } };
            }) => Promise<Array<Record<string, unknown>>>;
          };
        }) => Promise<Array<Record<string, unknown>>>
      ) =>
        callback({
          mediaAsset: {
            createMany: async ({ data }) => {
              records.push(
                ...data.map((item, index) => ({
                  ...item,
                  created_at: new Date(index),
                  id: `media-${index}`
                }))
              );
            },
            findMany: async ({ where }) =>
              records.filter((record) => where.storage_key.in.includes(record.storage_key))
          }
        })
    };

    try {
      const assets = await createDirectMediaUpload(
        {
          body: input,
          contentType: "image/jpeg",
          fileName: "guest-photo.jpg",
          kind: "SUBMISSION_PHOTO",
          ownerId: "submission-direct-test",
          ownerType: "SUBMISSION"
        },
        db as never
      );

      expect(assets).toHaveLength(2);
      expect(assets.map((asset) => asset.kind).sort()).toEqual([
        "SUBMISSION_PHOTO",
        "SUBMISSION_THUMBNAIL"
      ]);
      expect(assets.every((asset) => asset.status === "READY")).toBe(true);
    } finally {
      await Promise.all(
        records.map((record) =>
          typeof record.storage_key === "string"
            ? deleteLocalMediaObject(record.storage_key)
            : Promise.resolve()
        )
      );
    }
  });

  it("removes every newly written object when the asset transaction fails", async () => {
    const input = await sharp({
      create: {
        background: "#3b556f",
        channels: 3,
        height: 900,
        width: 1200
      }
    })
      .jpeg()
      .toBuffer();
    const transactionError = new Error("asset transaction failed");
    const records: Array<Record<string, unknown>> = [];
    const db = {
      $transaction: async (
        callback: (tx: {
          mediaAsset: {
            createMany: (input: { data: Array<Record<string, unknown>> }) => Promise<void>;
            findMany: () => Promise<Array<Record<string, unknown>>>;
          };
        }) => Promise<Array<Record<string, unknown>>>
      ) =>
        callback({
          mediaAsset: {
            createMany: async ({ data }) => {
              records.push(...data);
              throw transactionError;
            },
            findMany: async () => []
          }
        })
    };

    try {
      await expect(
        createDirectMediaUpload(
          {
            body: input,
            contentType: "image/jpeg",
            fileName: "rollback.jpg",
            kind: "SUBMISSION_PHOTO",
            ownerId: "submission-rollback-test",
            ownerType: "SUBMISSION"
          },
          db as never
        )
      ).rejects.toBe(transactionError);

      expect(records).toHaveLength(2);

      for (const record of records) {
        expect(typeof record.storage_key).toBe("string");
        await expect(getLocalMediaObjectBuffer(String(record.storage_key))).rejects.toThrow();
      }
    } finally {
      await Promise.all(
        records.map((record) =>
          typeof record.storage_key === "string"
            ? deleteLocalMediaObject(record.storage_key)
            : Promise.resolve()
        )
      );
    }
  });
});
