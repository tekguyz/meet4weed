/** @vitest-environment node
 *
 *  Calls the REAL Claude API with the synthetic fixtures. Costs money — about
 *  a cent per case — so it runs only when asked:
 *
 *    VISION_LIVE=1 npm run test:vision-live
 *
 *  It prints the token usage and cost of every call; the total is the
 *  measured per-check cost recorded in spec §4.4.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";
import { readCard, type VisionInput, type VisionResult } from "@/lib/verification/vision";

config({ path: ".env.local", quiet: true });

const LIVE = process.env.VISION_LIVE === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
const FIXTURES = path.resolve(import.meta.dirname, "../../../supabase/tests/fixtures/vision");
const image = (name: string) => readFileSync(path.join(FIXTURES, name));

const base = (): VisionInput => ({
  card: image("card-clean.jpg"),
  face: image("face-with-card.jpg"),
  typedPatientId: "P000-TEST-0001",
  typedExpiry: "2027-06-30",
  challenge: "Tilt your head to one side",
  today: "2026-09-17",
});

const spend: { name: string; result: VisionResult }[] = [];

async function run(name: string, input: VisionInput) {
  const result = await readCard(new Anthropic(), input);
  spend.push({ name, result });
  return result;
}

describe.skipIf(!LIVE)("claude-sonnet-5 reading synthetic cards (live)", () => {
  afterAll(() => {
    let total = 0;
    for (const { name, result } of spend) {
      total += result.costUsd;
      console.log(`${name}: in=${result.usage?.inputTokens} out=${result.usage?.outputTokens} cost=$${result.costUsd.toFixed(4)}`);
    }
    console.log(`TOTAL ${spend.length} calls: $${total.toFixed(4)}, mean $${(total / Math.max(spend.length, 1)).toFixed(4)} per check`);
  });

  it("reads a clean card and sees that the typed fields match", async () => {
    const result = await run("clean", base());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.patientId?.replace(/[\s-]/g, "").toUpperCase()).toBe("P000TEST0001");
    expect(result.reading.expiryDate).toBe("2027-06-30");
    expect(result.reading.typedFieldsMatch).toBe(true);
  }, 90_000);

  it("notices a typed patient ID that does not match the card", async () => {
    const result = await run("mismatched-id", { ...base(), typedPatientId: "P000-TEST-9999" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.typedFieldsMatch).toBe(false);
    expect(result.reading.concerns.length).toBeGreaterThan(0);
  }, 90_000);

  it("raises an expired card as a concern", async () => {
    const result = await run("expired", { ...base(), card: image("card-expired.jpg"), typedExpiry: "2025-01-31" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.expiryDate).toBe("2025-01-31");
    expect(result.reading.concerns.join(" ")).toMatch(/expir/i);
  }, 90_000);

  it("does not claim to read a blurry card", async () => {
    const result = await run("blurry", { ...base(), card: image("card-blurry.jpg") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const admitsIt = !result.reading.fieldsLegible || result.reading.patientId === null || result.reading.concerns.length > 0;
    expect(admitsIt).toBe(true);
  }, 90_000);
});
