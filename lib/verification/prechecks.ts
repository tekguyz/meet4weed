/**
 * Free on-device pre-checks (spec §4.1 step 6, §4.4 item 5). Junk is caught on
 * the phone and never costs an API call. Pure functions over RGBA pixels, so
 * they are testable without a camera.
 *
 * Thresholds are starting values. Task 10 of Plan 02 calibrates them on real
 * phones; change them here and nowhere else.
 */

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type PrecheckProblem = "blurry" | "glare" | "no_card" | "no_face";

export const CARD_ASPECT = 1.586; // ISO/IEC 7810 ID-1: 85.60 × 53.98 mm

export const PRECHECK_THRESHOLDS = {
  minSharpness: 40,
  maxGlare: 0.08,
  minEdgeStrength: 40,
  minEdgeSides: 3,
} as const;

export function cardGuide(width: number, height: number): Rect {
  const w = Math.round(width * 0.84);
  const h = Math.round(w / CARD_ASPECT);
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), width: w, height: h };
}

function luma(p: Pixels): Float32Array {
  const out = new Float32Array(p.width * p.height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];
  }
  return out;
}

const whole = (p: Pixels): Rect => ({ x: 0, y: 0, width: p.width, height: p.height });

export function sharpness(p: Pixels, rect: Rect = whole(p)): number {
  const l = luma(p);
  const w = p.width;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  const x0 = Math.max(1, rect.x);
  const y0 = Math.max(1, rect.y);
  const x1 = Math.min(p.width - 1, rect.x + rect.width);
  const y1 = Math.min(p.height - 1, rect.y + rect.height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      const lap = l[i - 1] + l[i + 1] + l[i - w] + l[i + w] - 4 * l[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function glareRatio(p: Pixels, rect: Rect): number {
  const l = luma(p);
  let bright = 0;
  let n = 0;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (l[y * p.width + x] >= 252) bright++;
      n++;
    }
  }
  return n === 0 ? 0 : bright / n;
}

/** How many sides of the guide have a strong straight edge near them. */
export function edgeSides(p: Pixels, rect: Rect): number {
  const l = luma(p);
  const w = p.width;
  const h = p.height;
  const band = Math.max(3, Math.round(w * 0.04));
  const at = (x: number, y: number) => l[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];

  // Strongest row of vertical gradient (|l(x, y+1) - l(x, y-1)|) near a horizontal side.
  const horizontal = (sideY: number) => {
    let best = 0;
    for (let y = sideY - band; y <= sideY + band; y++) {
      let sum = 0;
      for (let x = rect.x; x < rect.x + rect.width; x++) sum += Math.abs(at(x, y + 1) - at(x, y - 1));
      best = Math.max(best, sum / rect.width);
    }
    return best;
  };

  // Strongest column of horizontal gradient near a vertical side.
  const vertical = (sideX: number) => {
    let best = 0;
    for (let x = sideX - band; x <= sideX + band; x++) {
      let sum = 0;
      for (let y = rect.y; y < rect.y + rect.height; y++) sum += Math.abs(at(x + 1, y) - at(x - 1, y));
      best = Math.max(best, sum / rect.height);
    }
    return best;
  };

  const strengths = [
    horizontal(rect.y),
    horizontal(rect.y + rect.height),
    vertical(rect.x),
    vertical(rect.x + rect.width),
  ];
  return strengths.filter((s) => s >= PRECHECK_THRESHOLDS.minEdgeStrength).length;
}

export function checkCardPhoto(p: Pixels): PrecheckProblem[] {
  const guide = cardGuide(p.width, p.height);
  const problems: PrecheckProblem[] = [];
  if (sharpness(p, guide) < PRECHECK_THRESHOLDS.minSharpness) problems.push("blurry");
  if (glareRatio(p, guide) > PRECHECK_THRESHOLDS.maxGlare) problems.push("glare");
  if (edgeSides(p, guide) < PRECHECK_THRESHOLDS.minEdgeSides) problems.push("no_card");
  return problems;
}

/** `faceCount` is null when the face detector could not load. That skips the
 *  face check rather than blocking the member; Claude and the reviewer still
 *  see the photo. */
export function checkFacePhoto(p: Pixels, faceCount: number | null): PrecheckProblem[] {
  const problems: PrecheckProblem[] = [];
  if (sharpness(p) < PRECHECK_THRESHOLDS.minSharpness) problems.push("blurry");
  if (faceCount !== null && faceCount < 1) problems.push("no_face");
  return problems;
}
