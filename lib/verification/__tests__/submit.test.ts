/** @vitest-environment node
 *
 *  Spec §4.4 and §9: every limit gets a test proving the Claude call is
 *  skipped once it is exceeded. `vision.calls` is the proof in each case.
 */
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createLimits, type Counter } from "@/lib/verification/limits";
import type { RecordedVision, VerificationStore } from "@/lib/verification/store";
import { submitVerification, type SubmissionInput, type SubmitDeps } from "@/lib/verification/submit";
import type { VisionResult } from "@/lib/verification/vision";

const TODAY = "2026-09-17";
let CARD: Uint8Array;
let FACE: Uint8Array;
let HUGE: Uint8Array;
let PNG: Uint8Array;

beforeAll(async () => {
  const make = (w: number, h: number) =>
    sharp({ create: { width: w, height: h, channels: 3, background: "#806040" } }).jpeg({ quality: 70 }).toBuffer();
  CARD = await make(1000, 630);
  FACE = await make(1000, 750);
  HUGE = await make(4032, 3024);
  PNG = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).png().toBuffer();
});

function memoryCounter(): Counter {
  const counts = new Map<string, number>();
  return {
    incr: async (key) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    expire: async () => 1,
  };
}

type Options = {
  member?: { attested: boolean; status: "unverified" | "pending_review" | "verified" | "expired" | "suspended" } | null;
  counter?: Counter;
  limits?: { memberDaily: number; ipDaily: number; visionDaily: number };
  vision?: VisionResult;
  storageFails?: boolean;
  alertFails?: boolean;
};

const READ_OK: VisionResult = {
  ok: true,
  reading: {
    nameOnCard: "SAMPLE, JORDAN",
    patientId: "P000-TEST-0001",
    expiryDate: "2027-06-30",
    fieldsLegible: true,
    typedFieldsMatch: true,
    cardVisibleInFacePhoto: true,
    challengeAppearsPerformed: true,
    concerns: [],
  },
  usage: { inputTokens: 2400, outputTokens: 350 },
  costUsd: 0.0083,
  model: "claude-sonnet-5",
};

function harness(options: Options = {}) {
  const calls = {
    vision: [] as unknown[],
    begun: 0,
    stored: [] as string[],
    recorded: [] as RecordedVision[],
    lapsed: [] as string[],
    alerts: 0,
  };
  const store: VerificationStore = {
    getMember: async () => (options.member === undefined ? { attested: true, status: "unverified" } : options.member),
    begin: async () => {
      calls.begun += 1;
      return { ok: true, id: `v${calls.begun}` };
    },
    storeImage: async ({ kind }) => {
      if (options.storageFails) throw new Error("storage down");
      calls.stored.push(kind);
    },
    recordVision: async (_id, recorded) => void calls.recorded.push(recorded),
    lapse: async (id) => void calls.lapsed.push(id),
  };
  const deps: SubmitDeps = {
    store,
    limits: createLimits(options.counter ?? memoryCounter(), options.limits ?? { memberDaily: 3, ipDaily: 10, visionDaily: 50 }),
    vision: async (input) => {
      calls.vision.push(input);
      return options.vision ?? READ_OK;
    },
    alertOwner: async () => {
      calls.alerts += 1;
      if (options.alertFails) throw new Error("resend down");
    },
    verifyChallenge: (token, memberId) => (token === `good-token-for-${memberId}` ? "Tilt your head to one side" : null),
    today: () => TODAY,
  };
  return { deps, calls };
}

const input = (overrides: Partial<SubmissionInput> = {}): SubmissionInput => ({
  memberId: "member-a",
  ip: "203.0.113.7",
  patientId: "P000-TEST-0001",
  cardExpiresOn: "2027-06-30",
  challengeToken: "good-token-for-member-a",
  card: CARD,
  face: FACE,
  ...overrides,
});

const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("submitVerification — refusals that never reach Claude", () => {
  it.each([
    ["signed out", { memberId: null }, {}, 401, "sign_in"],
    ["not attested", {}, { member: { attested: false, status: "unverified" } }, 403, "not_attested"],
    ["suspended", {}, { member: { attested: true, status: "suspended" } }, 403, "suspended"],
    ["already pending", {}, { member: { attested: true, status: "pending_review" } }, 409, "already_pending"],
    ["no patient ID", { patientId: "  " }, {}, 400, "invalid_fields"],
    ["an expired card", { cardExpiresOn: "2026-09-16" }, {}, 400, "card_expired"],
    ["a missing photo", { face: null }, {}, 400, "missing_image"],
    ["a PNG", { card: "PNG" }, {}, 415, "not_jpeg"],
    ["an unresized photo", { face: "HUGE" }, {}, 413, "image_too_large"],
    ["a bad challenge token", { challengeToken: "forged" }, {}, 400, "challenge_expired"],
  ] as const)("refuses %s", async (_name, inputOverrides, options, status, error) => {
    const { deps, calls } = harness(options as Options);
    const overrides = { ...inputOverrides } as Record<string, unknown>;
    if (overrides.card === "PNG") overrides.card = PNG;
    if (overrides.face === "HUGE") overrides.face = HUGE;

    const outcome = await submitVerification(input(overrides as Partial<SubmissionInput>), deps);

    expect(outcome).toEqual({ status, body: { ok: false, error } });
    expect(calls.vision).toHaveLength(0);
    expect(calls.begun).toBe(0);
    expect(calls.stored).toHaveLength(0);
  });
});

describe("submitVerification — cost controls", () => {
  it("control 3: a member's fourth submission of the day is refused and Claude is not called", async () => {
    const counter = memoryCounter();
    for (let i = 0; i < 3; i++) {
      const { deps } = harness({ counter });
      expect((await submitVerification(input(), deps)).status).toBe(200);
    }
    const { deps, calls } = harness({ counter });
    expect(await submitVerification(input(), deps)).toEqual({ status: 429, body: { ok: false, error: "member_limit" } });
    expect(calls.vision).toHaveLength(0);
    expect(calls.begun).toBe(0);
  });

  it("control 3: an IP over its limit is refused and Claude is not called", async () => {
    const counter = memoryCounter();
    const limits = { memberDaily: 3, ipDaily: 2, visionDaily: 50 };
    for (const member of ["a", "b"]) {
      const { deps } = harness({ counter, limits });
      await submitVerification(input({ memberId: member, challengeToken: `good-token-for-${member}` }), deps);
    }
    const { deps, calls } = harness({ counter, limits });
    const outcome = await submitVerification(input({ memberId: "c", challengeToken: "good-token-for-c" }), deps);
    expect(outcome).toEqual({ status: 429, body: { ok: false, error: "ip_limit" } });
    expect(calls.vision).toHaveLength(0);
  });

  it("control 4: past the daily ceiling the submission is stored and queued, and Claude is not called", async () => {
    const counter = memoryCounter();
    const limits = { memberDaily: 3, ipDaily: 10, visionDaily: 1 };
    await submitVerification(input({ memberId: "a", challengeToken: "good-token-for-a" }), harness({ counter, limits }).deps);

    const { deps, calls } = harness({ counter, limits });
    const outcome = await submitVerification(input({ memberId: "b", challengeToken: "good-token-for-b" }), deps);

    expect(outcome).toEqual({ status: 200, body: { ok: true } });
    expect(calls.vision).toHaveLength(0);
    expect(calls.stored).toEqual(["card", "face_with_card"]);
    expect(calls.recorded).toEqual([
      expect.objectContaining({ skippedReason: "daily_ceiling", model: null, costUsd: null }),
    ]);
    expect(calls.alerts).toBe(1);
  });

  it("with Upstash down the submission is queued and Claude is not called", async () => {
    const log = quiet();
    const broken: Counter = { incr: async () => { throw new Error("down"); }, expire: async () => 1 };
    const { deps, calls } = harness({ counter: broken });
    expect((await submitVerification(input(), deps)).status).toBe(200);
    expect(calls.vision).toHaveLength(0);
    expect(calls.recorded).toEqual([expect.objectContaining({ skippedReason: "limiter_unavailable" })]);
    log.mockRestore();
  });

  it("control 8: a Claude call records its tokens and cost", async () => {
    const { deps, calls } = harness();
    await submitVerification(input(), deps);
    expect(calls.recorded).toEqual([
      expect.objectContaining({
        model: "claude-sonnet-5",
        inputTokens: 2400,
        outputTokens: 350,
        costUsd: 0.0083,
        skippedReason: null,
        error: null,
      }),
    ]);
  });
});

describe("submitVerification — the happy path and its failures", () => {
  it("stores both images, then asks Claude with the typed fields, the challenge and today", async () => {
    const { deps, calls } = harness();
    expect(await submitVerification(input(), deps)).toEqual({ status: 200, body: { ok: true } });
    expect(calls.stored).toEqual(["card", "face_with_card"]);
    expect(calls.vision).toEqual([
      expect.objectContaining({
        typedPatientId: "P000-TEST-0001",
        typedExpiry: "2027-06-30",
        challenge: "Tilt your head to one side",
        today: TODAY,
      }),
    ]);
    expect(calls.alerts).toBe(1);
  });

  it("a failed Claude read still queues the submission for a person", async () => {
    const { deps, calls } = harness({
      vision: { ok: false, error: "api_error:529", usage: null, costUsd: 0, model: "claude-sonnet-5" },
    });
    expect((await submitVerification(input(), deps)).status).toBe(200);
    expect(calls.recorded).toEqual([expect.objectContaining({ error: "api_error:529", reading: null })]);
    expect(calls.alerts).toBe(1);
  });

  it("a storage failure lapses the submission and never calls Claude", async () => {
    const log = quiet();
    const { deps, calls } = harness({ storageFails: true });
    expect(await submitVerification(input(), deps)).toEqual({ status: 500, body: { ok: false, error: "storage_failed" } });
    expect(calls.lapsed).toEqual(["v1"]);
    expect(calls.vision).toHaveLength(0);
    log.mockRestore();
  });

  it("a failed owner alert does not fail the member's submission", async () => {
    const log = quiet();
    const { deps } = harness({ alertFails: true });
    expect((await submitVerification(input(), deps)).status).toBe(200);
    log.mockRestore();
  });
});
