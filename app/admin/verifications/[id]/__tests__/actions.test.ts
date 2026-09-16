/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpcError: null as { code: string } | null,
  rpcCalls: [] as unknown[][],
  docs: [{ id: "d1", storage_path: "m/v/card.bin" }, { id: "d2", storage_path: "m/v/face_with_card.bin" }],
  removed: [] as unknown[],
  redirects: [] as string[],
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    state.redirects.push(to);
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (...args: unknown[]) => {
      state.rpcCalls.push(args);
      return { error: state.rpcError };
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: async () => ({ data: state.docs }) }) }),
  }),
}));
vi.mock("@/lib/verification/reaper", () => ({
  removeDocuments: async (_db: unknown, docs: unknown) => {
    state.removed.push(docs);
    return 2;
  },
}));

import { decideVerification } from "@/app/admin/verifications/[id]/actions";

const ID = "4b3c2a1d-0000-4000-8000-000000000001";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

beforeEach(() => Object.assign(state, { rpcError: null, rpcCalls: [], removed: [], redirects: [] }));

describe("decideVerification", () => {
  it("approves through decide_verification, then deletes both images", async () => {
    await expect(
      decideVerification(null, form({ id: ID, decision: "approve", cardExpiresOn: "2027-06-30" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(state.rpcCalls).toEqual([
      ["decide_verification", { p_id: ID, p_decision: "approve", p_reason: null, p_card_expires_on: "2027-06-30" }],
    ]);
    expect(state.removed).toEqual([state.docs]);
    expect(state.redirects).toEqual(["/admin/verifications"]);
  });

  it("deletes nothing when the database refuses the decision", async () => {
    state.rpcError = { code: "42501" };
    expect(await decideVerification(null, form({ id: ID, decision: "approve", cardExpiresOn: "2027-06-30" }))).toEqual({
      message: "Only an admin can decide.",
    });
    expect(state.removed).toEqual([]);
  });

  it("refuses a rejection with no reason before touching the database", async () => {
    expect(await decideVerification(null, form({ id: ID, decision: "reject", reason: " " }))).toEqual({
      message: "Write the reason the member will read.",
    });
    expect(state.rpcCalls).toEqual([]);
  });

  it("says plainly when someone else already decided", async () => {
    state.rpcError = { code: "M4W05" };
    expect(await decideVerification(null, form({ id: ID, decision: "retake", reason: "Card is cut off" }))).toEqual({
      message: "This submission was already decided.",
    });
  });
});
