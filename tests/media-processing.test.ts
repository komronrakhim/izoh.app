import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { processLogoImage, processSubmissionPhoto } from "~/server/media";

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
});
