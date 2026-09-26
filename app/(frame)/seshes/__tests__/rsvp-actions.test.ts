/** @vitest-environment node
 *
 *  These actions have one job: turn a database refusal into something a
 *  member can act on. The refusals themselves are proved against the real
 *  project in supabase/tests/__tests__/rsvp-rls.test.ts.
 *
 *  Every test here checks that the Postgres code never reaches a member. A
 *  raw "M4W14" on screen is a bug, not an error message.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();
const select = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => select() }) }),
    }),
  }),
}));

const claimRsvp = vi.fn();
vi.mock("@/lib/sesh/member-limits", () => ({
  memberLimitsFromEnv: () => ({ claimRsvp }),
}));

const notify = vi.fn();
vi.mock("@/lib/notify/notify", () => ({ notify }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => "admin-client" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const SESH = "11111111-1111-4111-8111-111111111111";
const RSVP = "22222222-2222-4222-8222-222222222222";
const GUEST = "33333333-3333-4333-8333-333333333333";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function refuse(code: string) {
  rpc.mockResolvedValue({ error: { code, message: `raised ${code}` } });
}

async function act(name: "askToJoin" | "withdrawRsvp" | "decideRsvp", fd: FormData) {
  const actions = await import("@/app/(frame)/seshes/rsvp-actions");
  return actions[name](null, fd);
}

const NO_POSTGRES_CODES = /M4W\d\d|42501|PGRST/;

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "member-1" } } });
  rpc.mockReset().mockResolvedValue({ error: null });
  select.mockReset().mockResolvedValue({ data: { approved_count: 4 } });
  claimRsvp.mockReset().mockResolvedValue(true);
  notify.mockReset().mockResolvedValue(undefined);
});

describe("askToJoin", () => {
  it("asks the database, naming the sesh", async () => {
    await act("askToJoin", form({ seshId: SESH }));

    expect(rpc).toHaveBeenCalledWith("request_rsvp", { p_sesh: SESH });
  });

  it("says it worked", async () => {
    const result = await act("askToJoin", form({ seshId: SESH }));

    expect(result.ok).toBe(true);
  });

  it("refuses without a real sesh, before troubling the database", async () => {
    const result = await act("askToJoin", form({ seshId: "not-a-uuid" }));

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tells a member the sesh filled up, in words", async () => {
    refuse("M4W14");

    const result = await act("askToJoin", form({ seshId: SESH }));

    expect(result.message).toMatch(/full|filled/i);
    expect(result.message).not.toMatch(NO_POSTGRES_CODES);
  });

  it("tells a member when they have asked too many times today", async () => {
    refuse("M4W17");

    const result = await act("askToJoin", form({ seshId: SESH }));

    expect(result.message).toMatch(/today|tomorrow/i);
    expect(result.message).not.toMatch(NO_POSTGRES_CODES);
  });

  /** Ticket #66. The database caps new requests at 20 rows a day, but a
   *  withdraw-and-ask loop reuses one row. This counts presses. */
  it("counts the press against the member, for today", async () => {
    await act("askToJoin", form({ seshId: SESH }));

    expect(claimRsvp).toHaveBeenCalledWith("member-1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("refuses whole over the daily limit, and never asks the database", async () => {
    claimRsvp.mockResolvedValue(false);

    const result = await act("askToJoin", form({ seshId: SESH }));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/tomorrow/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not count a press from someone signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await act("askToJoin", form({ seshId: SESH }));

    expect(claimRsvp).not.toHaveBeenCalled();
  });

  it("tells a member the host removed them, rather than letting them keep trying", async () => {
    refuse("M4W13");

    const result = await act("askToJoin", form({ seshId: SESH }));

    expect(result.message).toMatch(/host/i);
    expect(result.message).not.toMatch(NO_POSTGRES_CODES);
  });

  it("points an expired member at renewing", async () => {
    refuse("M4W10");

    const result = await act("askToJoin", form({ seshId: SESH }));

    expect(result.message).toMatch(/card|renew/i);
    expect(result.message).not.toMatch(NO_POSTGRES_CODES);
  });

  it("says a closed sesh is closed without explaining which way", async () => {
    refuse("M4W11");

    const result = await act("askToJoin", form({ seshId: SESH }));

    expect(result.message).not.toMatch(NO_POSTGRES_CODES);
    expect(result.message.length).toBeGreaterThan(10);
  });

  it("never prints a code it does not recognise", async () => {
    refuse("23505");

    const result = await act("askToJoin", form({ seshId: SESH }));

    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(NO_POSTGRES_CODES);
  });
});

describe("withdrawRsvp", () => {
  it("withdraws from the sesh", async () => {
    await act("withdrawRsvp", form({ seshId: SESH }));

    expect(rpc).toHaveBeenCalledWith("cancel_rsvp", { p_sesh: SESH });
  });

  it("does not leak a code when there was nothing to withdraw", async () => {
    refuse("M4W15");

    const result = await act("withdrawRsvp", form({ seshId: SESH }));

    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(NO_POSTGRES_CODES);
  });
});

describe("decideRsvp", () => {
  it("passes the host's decision through", async () => {
    await act("decideRsvp", form({ rsvpId: RSVP, decision: "approved", seshId: SESH }));

    expect(rpc).toHaveBeenCalledWith("decide_rsvp", { p_rsvp: RSVP, p_decision: "approved" });
  });

  it("takes deny and remove as well", async () => {
    await act("decideRsvp", form({ rsvpId: RSVP, decision: "kicked", seshId: SESH }));

    expect(rpc).toHaveBeenCalledWith("decide_rsvp", { p_rsvp: RSVP, p_decision: "kicked" });
  });

  /** A decision arrives from a form, so it arrives from anybody. */
  it("refuses a decision that is not one of the three, before the database sees it", async () => {
    const result = await act("decideRsvp", form({ rsvpId: RSVP, decision: "banned", seshId: SESH }));

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tells the host the sesh just filled up", async () => {
    refuse("M4W14");

    const result = await act("decideRsvp", form({ rsvpId: RSVP, decision: "approved", seshId: SESH }));

    expect(result.message).toMatch(/full|filled/i);
    expect(result.message).not.toMatch(NO_POSTGRES_CODES);
  });

  it("does not leak a code when somebody who is not the host tries", async () => {
    refuse("M4W15");

    const result = await act("decideRsvp", form({ rsvpId: RSVP, decision: "approved", seshId: SESH }));

    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(NO_POSTGRES_CODES);
  });

  /** Issue #50 — the first notification, end to end. */
  describe("telling the guest", () => {
    beforeEach(() => {
      select.mockResolvedValue({ data: { member_id: GUEST, sesh_id: SESH }, error: null });
    });

    it("writes exactly one notice when the host approves, addressed to the guest", async () => {
      await act("decideRsvp", form({ rsvpId: RSVP, decision: "approved", seshId: SESH }));

      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith("admin-client", {
        kind: "rsvp_approved",
        seshId: SESH,
        hostId: "member-1",
        guestId: GUEST,
      });
    });

    it("takes the sesh from the RSVP row, not from the form", async () => {
      const OTHER = "44444444-4444-4444-8444-444444444444";

      await act("decideRsvp", form({ rsvpId: RSVP, decision: "approved", seshId: OTHER }));

      expect(notify).toHaveBeenCalledWith("admin-client", expect.objectContaining({ seshId: SESH }));
    });

    it("writes nothing when the database refused the approval", async () => {
      refuse("M4W14");

      await act("decideRsvp", form({ rsvpId: RSVP, decision: "approved", seshId: SESH }));

      expect(notify).not.toHaveBeenCalled();
    });

    it("still says approved when the RSVP row cannot be read back", async () => {
      select.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

      const result = await act("decideRsvp", form({ rsvpId: RSVP, decision: "approved", seshId: SESH }));

      expect(result.ok).toBe(true);
      expect(notify).not.toHaveBeenCalled();
    });
  });
});
