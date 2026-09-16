/** @vitest-environment node */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { checkUploadedImage, IMAGE_LIMITS, isJpeg, jpegDimensions } from "@/lib/verification/jpeg";

const jpeg = (width: number, height: number, quality = 80) =>
  sharp({ create: { width, height, channels: 3, background: "#7a6a55" } }).jpeg({ quality }).toBuffer();

describe("jpeg checks", () => {
  it("reads the real dimensions", async () => {
    expect(jpegDimensions(await jpeg(1000, 630))).toEqual({ width: 1000, height: 630 });
  });

  it("accepts a capture-sized JPEG", async () => {
    expect(checkUploadedImage(await jpeg(1000, 750))).toBeNull();
  });

  it("refuses a PNG", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).png().toBuffer();
    expect(isJpeg(png)).toBe(false);
    expect(checkUploadedImage(png)).toBe("not_jpeg");
  });

  it("refuses an unresized phone photo by its long edge", async () => {
    expect(checkUploadedImage(await jpeg(4032, 3024, 10))).toBe("too_many_pixels");
  });

  it("refuses anything over the byte cap before reading it", () => {
    const big = new Uint8Array(IMAGE_LIMITS.maxBytes + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(checkUploadedImage(big)).toBe("too_large");
  });

  it("refuses a JPEG signature with nothing readable behind it", () => {
    expect(checkUploadedImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe("unreadable");
  });
});
