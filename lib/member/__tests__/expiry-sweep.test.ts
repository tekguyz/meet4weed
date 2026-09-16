/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { expiryEmail, runExpirySweep } from "@/lib/member/expiry-sweep";

function fakeDb(rows: { member_id: string; email: string; card_expires_on: string }[]) {
  const inserted: unknown[] = [];
  const db = {
    rpc: vi.fn(async () => ({ data: rows, error: null })),
    from: vi.fn(() => ({
      insert: async (row: unknown) => {
        inserted.push(row);
        return { error: null };
      },
    })),
  };
  return { db: db as never, inserted, rpc: db.rpc };
}

describe("runExpirySweep", () => {
  it("emails each listed member once and records the notice after the send", async () => {
    const { db, inserted, rpc } = fakeDb([
      { member_id: "m1", email: "one@example.com", card_expires_on: "2026-09-17" },
      { member_id: "m2", email: "two@example.com", card_expires_on: "2026-09-15" },
    ]);
    const send = vi.fn(async () => undefined);

    expect(await runExpirySweep(db, "2026-09-17", send)).toEqual({ notified: 2, failed: 0 });
    expect(rpc).toHaveBeenCalledWith("expiry_sweep", { p_today: "2026-09-17" });
    expect(send.mock.calls).toEqual([
      ["one@example.com", "2026-09-17"],
      ["two@example.com", "2026-09-15"],
    ]);
    expect(inserted).toEqual([
      { member_id: "m1", card_expires_on: "2026-09-17" },
      { member_id: "m2", card_expires_on: "2026-09-15" },
    ]);
  });

  it("records no notice when the send fails, so tomorrow's run tries again", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, inserted } = fakeDb([{ member_id: "m1", email: "one@example.com", card_expires_on: "2026-09-17" }]);
    const send = vi.fn(async () => {
      throw new Error("resend down");
    });
    expect(await runExpirySweep(db, "2026-09-17", send)).toEqual({ notified: 0, failed: 1 });
    expect(inserted).toEqual([]);
    log.mockRestore();
  });
});

describe("expiryEmail", () => {
  it("on the day, says today and explains read-only", () => {
    const email = expiryEmail("2026-09-17", "2026-09-17", "https://m4w.example/verify");
    expect(email.subject).toBe("Your Meet4Weed card expires today");
    expect(email.text).toContain("read-only");
    expect(email.text).toContain("https://m4w.example/verify");
    expect(email.text).toContain("only email");
  });

  it("after a missed day, says it has expired", () => {
    expect(expiryEmail("2026-09-15", "2026-09-17", "https://x").subject).toBe("Your Meet4Weed card has expired");
  });
});
