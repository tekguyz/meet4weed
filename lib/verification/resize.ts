/** Spec §4.1 step 7: resized on the device to about 1000 px on the long edge.
 *  Unresized phone photos roughly double the cost of a check. */

export function fitWithin(width: number, height: number, maxLongEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function drawScaled(source: CanvasImageSource, width: number, height: number, maxLongEdge: number): HTMLCanvasElement {
  const size = fitWithin(width, height, maxLongEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2d context unavailable");
  context.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

export function toJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))), "image/jpeg", quality),
  );
}
