/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { costOf, readCard, VISION_MODEL, type VisionClient } from "@/lib/verification/vision";

const INPUT = {
  card: Buffer.from("card-bytes"),
  face: Buffer.from("face-bytes"),
  typedPatientId: "P000-TEST-0001",
  typedExpiry: "2027-06-30",
  challenge: "Hold up two fingers beside the card",
  today: "2026-09-17",
};

const READING = {
  nameOnCard: "SAMPLE, JORDAN",
  patientId: "P000-TEST-0001",
  expiryDate: "2027-06-30",
  fieldsLegible: true,
  typedFieldsMatch: true,
  cardVisibleInFacePhoto: true,
  challengeAppearsPerformed: true,
  concerns: [],
};

function fakeClient(response: object | Error) {
  const parse = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { client: { messages: { parse } } as unknown as VisionClient, parse };
}

describe("readCard", () => {
  it("sends both images, the typed fields, the challenge and today's date to claude-sonnet-5", async () => {
    const { client, parse } = fakeClient({
      stop_reason: "end_turn",
      parsed_output: READING,
      usage: { input_tokens: 2400, output_tokens: 350 },
    });

    await readCard(client, INPUT);

    const request = (parse.mock.calls[0] as unknown[])[0] as {
      model: string;
      output_config: { effort: string; format: unknown };
      messages: { content: { type: string; source?: { media_type: string; data: string }; text?: string }[] }[];
    };
    expect(request.model).toBe("claude-sonnet-5");
    expect(request.output_config.effort).toBe("low");
    expect(request.output_config.format).toBeDefined();

    const blocks = request.messages[0].content;
    const images = blocks.filter((b) => b.type === "image");
    expect(images.map((b) => b.source!.media_type)).toEqual(["image/jpeg", "image/jpeg"]);
    expect(images.map((b) => b.source!.data)).toEqual([
      Buffer.from("card-bytes").toString("base64"),
      Buffer.from("face-bytes").toString("base64"),
    ]);
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    expect(text).toContain("P000-TEST-0001");
    expect(text).toContain("2027-06-30");
    expect(text).toContain("Hold up two fingers beside the card");
    expect(text).toContain("2026-09-17");
  });

  it("returns the reading with its token usage and cost", async () => {
    const { client } = fakeClient({
      stop_reason: "end_turn",
      parsed_output: READING,
      usage: { input_tokens: 2400, output_tokens: 350 },
    });

    expect(await readCard(client, INPUT)).toEqual({
      ok: true,
      reading: READING,
      usage: { inputTokens: 2400, outputTokens: 350 },
      costUsd: 0.0083,
      model: VISION_MODEL,
    });
  });

  it("reports a refusal as a failed read, still with its cost", async () => {
    const { client } = fakeClient({
      stop_reason: "refusal",
      parsed_output: null,
      usage: { input_tokens: 2400, output_tokens: 10 },
    });
    const result = await readCard(client, INPUT);
    expect(result).toMatchObject({ ok: false, error: "refusal", usage: { inputTokens: 2400, outputTokens: 10 } });
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it("never throws when the API call fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient(new Error("socket hang up"));
    expect(await readCard(client, INPUT)).toEqual({
      ok: false,
      error: "failed:Error",
      usage: null,
      costUsd: 0,
      model: VISION_MODEL,
    });
    log.mockRestore();
  });

  it("prices tokens at $2 in and $10 out per million", () => {
    expect(costOf({ inputTokens: 1_000_000, outputTokens: 0 })).toBe(2);
    expect(costOf({ inputTokens: 0, outputTokens: 1_000_000 })).toBe(10);
  });
});
