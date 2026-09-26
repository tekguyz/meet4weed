/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { notify } from "@/lib/notify/notify";

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

  it("does not touch the database when the event produces no rows", async () => {
    const { db, from } = fakeDb();

    await notify(db, { ...approved, guestId: HOST });

    expect(from).not.toHaveBeenCalled();
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
