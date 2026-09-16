import { describe, expect, it } from "vitest";
import { cardGuide, checkCardPhoto, checkFacePhoto, type Pixels } from "@/lib/verification/prechecks";

const W = 800;
const H = 600;

function scene(paint: (x: number, y: number) => number): Pixels {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = paint(x, y);
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

const guide = cardGuide(W, H);
const inGuide = (x: number, y: number) =>
  x >= guide.x && x < guide.x + guide.width && y >= guide.y && y < guide.y + guide.height;

// A light card on a dark table, with short dark "words" on it.
const cardPainter = (x: number, y: number) => {
  if (!inGuide(x, y)) return 35;
  const row = Math.floor((y - guide.y) / 24);
  const inTextRow = (y - guide.y) % 24 < 6 && row > 1;
  const inWord = (x - guide.x) % 60 < 38;
  return inTextRow && inWord ? 40 : 210;
};

function boxBlur(p: Pixels, radius: number, passes = 3): Pixels {
  let src = p.data;
  for (let pass = 0; pass < passes; pass++) {
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = Math.min(W - 1, Math.max(0, x + dx));
            const yy = Math.min(H - 1, Math.max(0, y + dy));
            sum += src[(yy * W + xx) * 4];
            n++;
          }
        }
        const i = (y * W + x) * 4;
        out[i] = out[i + 1] = out[i + 2] = sum / n;
        out[i + 3] = 255;
      }
    }
    src = out;
  }
  return { data: src, width: W, height: H };
}

// Deterministic speckle: texture with no straight edges anywhere.
function speckle(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return 90 + Math.floor((n - Math.floor(n)) * 40);
}

describe("cardGuide", () => {
  it("is a card-shaped box, 84% of the frame width, centred", () => {
    expect(guide.width).toBe(Math.round(W * 0.84));
    expect(guide.width / guide.height).toBeCloseTo(1.586, 1);
    expect(guide.x + guide.width / 2).toBeCloseTo(W / 2, 0);
    expect(guide.y + guide.height / 2).toBeCloseTo(H / 2, 0);
  });
});

describe("checkCardPhoto", () => {
  it("passes a sharp card sitting in the guide", () => {
    expect(checkCardPhoto(scene(cardPainter))).toEqual([]);
  });

  it("flags a blurry photo", () => {
    expect(checkCardPhoto(boxBlur(scene(cardPainter), 4))).toContain("blurry");
  });

  it("flags glare across the card", () => {
    const glare = scene((x, y) =>
      inGuide(x, y) && x < guide.x + guide.width * 0.5 && y < guide.y + guide.height * 0.5 ? 255 : cardPainter(x, y),
    );
    expect(checkCardPhoto(glare)).toContain("glare");
  });

  it("flags a photo with no card edges in the guide", () => {
    expect(checkCardPhoto(scene(speckle))).toContain("no_card");
  });

  it("tolerates a card that misses one side of the guide", () => {
    const shifted = scene((x, y) => (x > guide.x + guide.width - 20 ? 35 : cardPainter(Math.max(x, guide.x), y)));
    expect(checkCardPhoto(shifted)).not.toContain("no_card");
  });
});

describe("checkFacePhoto", () => {
  it("passes a sharp photo with one face", () => {
    expect(checkFacePhoto(scene(cardPainter), 1)).toEqual([]);
  });

  it("flags no face", () => {
    expect(checkFacePhoto(scene(cardPainter), 0)).toEqual(["no_face"]);
  });

  it("does not block anyone when the detector could not load", () => {
    expect(checkFacePhoto(scene(cardPainter), null)).toEqual([]);
  });

  it("flags blur", () => {
    expect(checkFacePhoto(boxBlur(scene(cardPainter), 4), 1)).toContain("blurry");
  });
});
