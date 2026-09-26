/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { notify, notifyOnce } from "@/lib/notify/notify";

const SESH = "11111111-1111-4111-8111-111111111111";
const HOST = "22222222-2222-4222-8222-222222222222";
const GUEST = "33333333-3333-4333-8333-333333333333";

function fakeDb(error: { code: string } | null = null) {
  const inserted: unknown[] = [];
  const from = vi.fn(() => ({
    insert: async (rows: unknown) => {
      inserted.push(rows);
      return { error };
    },
  }));
  return { db: { from } as never, from, inserted };
}

const approved = { kind: "rsvp_approved", seshId: SESH, hostId: HOST, guestId: GUEST } as const;

describe("notify", () => {
  it("writes the event's rows to public.notifications in one insert", async () => {
    const { db, from, inserted } = fakeDb();

    await notify(db, approved);

    expect(from).toHaveBeenCalledWith("notifications");
    expect(inserted).toEqual([
      [{ recipient_id: GUEST, type: "rsvp_approved", sesh_id: SESH, actor_id: HOST, payload: {} }],
    ]);
  });

  /** The thing the notification is about already happened. A failed write
   *  must not turn a done approval into an error the host sees. */
  it("logs a failed write by code and does not throw", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb({ code: "42501" });

    await expect(notify(db, approved)).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(expect.stringContaining("42501"));
    log.mockRestore();
  });
});

describe("notifyOnce", () => {
  function fakeUpsertDb(written: number, error: { code: string } | null = null) {
    const calls: { rows: unknown; options: unknown }[] = [];
    const from = vi.fn(() => ({
      upsert: (rows: unknown, options: unknown) => {
        calls.push({ rows, options });
        return { select: async () => ({ data: error ? null : Array.from({ length: written }, (_, i) => ({ id: `n${i}` })), error }) };
      },
    }));
    return { db: { from } as never, calls };
  }

  const reminder = { kind: "sesh_reminder", seshId: SESH, hostId: HOST, startsAt: "2026-09-27T18:00:00Z", guestIds: [GUEST] } as const;

  /** The unique index does the deduplication, not a read before the write. */
  it("upserts on the dedup index and ignores a row already written", async () => {
    const { db, calls } = fakeUpsertDb(1);

    expect(await notifyOnce(db, [reminder])).toBe(1);

    expect(calls).toHaveLength(1);
    expect(calls[0].options).toEqual({ onConflict: "recipient_id,type,dedup_key", ignoreDuplicates: true });
  });

  it("writes nothing for no events", async () => {
    const { db, calls } = fakeUpsertDb(0);
    expect(await notifyOnce(db, [])).toBe(0);
    expect(calls).toHaveLength(0);
  });

  /** A cron run that reports 0 on a failed write reads like a clean rerun. */
  it("throws on a failed write, naming the code", async () => {
    const { db } = fakeUpsertDb(0, { code: "42P10" });
    await expect(notifyOnce(db, [reminder])).rejects.toThrow("42P10");
  });
});
