// Renders SYNTHETIC verification fixtures. Nothing here is a real card or a
// real face, and every card says SPECIMEN across it. Spec §9: never commit a
// real card or a real face — real photos for a hand test go in private/.
//
//   npm run fixtures:vision
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve("supabase/tests/fixtures/vision");
mkdirSync(OUT, { recursive: true });

const card = ({ expires }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="630">
  <rect width="1000" height="630" rx="36" fill="#f4f1e8"/>
  <rect width="1000" height="110" rx="36" fill="#2f6d4f"/>
  <rect y="70" width="1000" height="40" fill="#2f6d4f"/>
  <text x="40" y="72" font-family="Arial" font-size="40" font-weight="700" fill="#ffffff">TEST REGISTRY CARD</text>
  <rect x="40" y="150" width="240" height="300" fill="#c9c2b0"/>
  <circle cx="160" cy="260" r="70" fill="#8a7f6a"/>
  <rect x="80" y="340" width="160" height="110" rx="60" fill="#8a7f6a"/>
  <text x="320" y="200" font-family="Arial" font-size="28" fill="#333">NAME</text>
  <text x="320" y="245" font-family="Arial" font-size="42" font-weight="700" fill="#111">SAMPLE, JORDAN</text>
  <text x="320" y="310" font-family="Arial" font-size="28" fill="#333">PATIENT ID</text>
  <text x="320" y="355" font-family="Arial" font-size="42" font-weight="700" fill="#111">P000-TEST-0001</text>
  <text x="320" y="420" font-family="Arial" font-size="28" fill="#333">EXPIRES</text>
  <text x="320" y="465" font-family="Arial" font-size="42" font-weight="700" fill="#111">${expires}</text>
  <text x="500" y="590" font-family="Arial" font-size="64" font-weight="700" fill="#c0392b" fill-opacity="0.55" text-anchor="middle">SPECIMEN - NOT VALID</text>
</svg>`;

// A cartoon, not a face: a head, a raised hand with two fingers, and a small card.
const faceWithCard = (cardPng) => `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1000" height="750">
  <rect width="1000" height="750" fill="#6f8fa3"/>
  <circle cx="420" cy="300" r="170" fill="#e0b48f"/>
  <circle cx="365" cy="270" r="18" fill="#222"/>
  <circle cx="475" cy="270" r="18" fill="#222"/>
  <path d="M350 370 Q420 420 490 370" stroke="#222" stroke-width="10" fill="none"/>
  <rect x="380" y="470" width="80" height="280" fill="#e0b48f"/>
  <rect x="690" y="330" width="120" height="170" rx="40" fill="#e0b48f"/>
  <rect x="700" y="170" width="40" height="190" rx="20" fill="#e0b48f"/>
  <rect x="760" y="160" width="40" height="200" rx="20" fill="#e0b48f"/>
  <image x="80" y="500" width="380" height="240" xlink:href="data:image/png;base64,${cardPng.toString("base64")}"/>
</svg>`;

const jpeg = (input) => sharp(Buffer.from(input)).jpeg({ quality: 85 });

const clean = await sharp(Buffer.from(card({ expires: "06/30/2027" }))).png().toBuffer();
await jpeg(card({ expires: "06/30/2027" })).toFile(path.join(OUT, "card-clean.jpg"));
await jpeg(card({ expires: "01/31/2025" })).toFile(path.join(OUT, "card-expired.jpg"));
await sharp(Buffer.from(card({ expires: "06/30/2027" }))).blur(9).jpeg({ quality: 85 }).toFile(path.join(OUT, "card-blurry.jpg"));
await jpeg(faceWithCard(clean)).toFile(path.join(OUT, "face-with-card.jpg"));

console.log("wrote 4 synthetic fixtures to", path.relative(process.cwd(), OUT));
