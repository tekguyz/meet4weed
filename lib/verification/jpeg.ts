/**
 * Image caps (spec §4.4 item 6), checked on bytes before anything is stored or
 * sent to Claude. The phone resizes to 1000 px on the long edge; the server
 * allows 1200 for rounding and refuses anything larger, because an unresized
 * photo roughly doubles the cost of a check.
 *
 * Client-safe: the capture step uses IMAGE_LIMITS too.
 */
export const IMAGE_LIMITS = { maxBytes: 1_000_000, maxLongEdge: 1200, captureLongEdge: 1000 } as const;

export type ImageProblem = "not_jpeg" | "too_large" | "too_many_pixels" | "unreadable";

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** Walks the marker segments to the first start-of-frame. */
export function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    const startOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (startOfFrame) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

export function checkUploadedImage(bytes: Uint8Array): ImageProblem | null {
  if (bytes.length > IMAGE_LIMITS.maxBytes) return "too_large";
  if (!isJpeg(bytes)) return "not_jpeg";
  const size = jpegDimensions(bytes);
  if (!size || size.width === 0 || size.height === 0) return "unreadable";
  if (Math.max(size.width, size.height) > IMAGE_LIMITS.maxLongEdge) return "too_many_pixels";
  return null;
}
