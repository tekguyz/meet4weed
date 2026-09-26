/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { pushNotices, type PushSender } from "@/lib/notify/push";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Sub = { id: string; member_id: string; endpoint: string; p256dh: string; auth: string };

function sub(id: string, member: string): Sub {
  return { id, member_id: member, endpoint: `https://push.example.test/${id}`, p256dh: `k-${id}`, auth: `a-${id}` };
}

function fakeDb(subs: Sub[], readError: { code: string } | null = null) {
  const deleted: string[] = [];
  const asked: string[][] = [];
  const from = vi.fn((table: string) => {
    expect(table).toBe("push_subscriptions");
    return {
      select: () => ({
        in: (_col: string, ids: string[]) => {
          asked.push(ids);
          return {
            order: async () => ({ data: readError ? null : subs.filter((s) => ids.includes(s.member_id)), error: readError }),
          };
        },
      }),
      delete: () => ({
        eq: async (_col: string, id: string) => {
          deleted.push(id);
          return { error: null };
        },
      }),
    };
  });
  return { db: { from } as never, deleted, asked };
}

function sender(fail: Record<string, unknown> = {}) {
  const sent: { endpoint: string; payload: string }[] = [];
  const s: PushSender = {
    sendNotification: vi.fn(async (subscription, payload) => {
      sent.push({ endpoint: subscription.endpoint, payload });
      const error = fail[subscription.endpoint];
      if (error) throw error;
      return {};
    }),
  };
  return { s, sent };
}

const approved = { recipient_id: ALICE, type: "rsvp_approved" } as const;

describe("pushNotices", () => {
  it("sends to every device the recipient has, and to nobody else", async () => {
    const { db } = fakeDb([sub("p1", ALICE), sub("p2", ALICE), sub("p3", BOB)]);
    const { s, sent } = sender();

    await pushNotices(db, s, [approved]);

    expect(sent.map((x) => x.endpoint).sort()).toEqual(["https://push.example.test/p1", "https://push.example.test/p2"]);
    expect(JSON.parse(sent[0].payload)).toMatchObject({ title: "Meet4Weed", body: "You have an update.", url: "/notifications" });
  });

  it("sends one push per device even when a member got several rows at once", async () => {
    const { db } = fakeDb([sub("p1", ALICE)]);
    const { s, sent } = sender();

    await pushNotices(db, s, [approved, { recipient_id: ALICE, type: "sesh_reminder" }]);

    expect(sent).toHaveLength(1);
  });

  it("uses the reminder's words only when every row is a reminder", async () => {
    const { db } = fakeDb([sub("p1", ALICE)]);
    const { s, sent } = sender();

    await pushNotices(db, s, [{ recipient_id: ALICE, type: "sesh_reminder" }]);

    expect(JSON.parse(sent[0].payload).body).toMatch(/starts within a day/);
  });

  it("deletes a device the push service says is gone (404 or 410), on the spot", async () => {
    const { db, deleted } = fakeDb([sub("gone", ALICE), sub("expired", ALICE), sub("busy", ALICE), sub("fine", ALICE)]);
    const { s } = sender({
      "https://push.example.test/gone": Object.assign(new Error("gone"), { statusCode: 410 }),
      "https://push.example.test/expired": Object.assign(new Error("nf"), { statusCode: 404 }),
      "https://push.example.test/busy": Object.assign(new Error("busy"), { statusCode: 429 }),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(pushNotices(db, s, [approved])).resolves.toBeUndefined();

    expect(deleted.sort()).toEqual(["expired", "gone"]);
    warn.mockRestore();
  });

  it("swallows every other failure, a network error and a failed read included", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db } = fakeDb([sub("p1", ALICE)]);
    const { s } = sender({ "https://push.example.test/p1": new Error("ECONNRESET") });
    await expect(pushNotices(db, s, [approved])).resolves.toBeUndefined();

    const broken = fakeDb([], { code: "42501" });
    await expect(pushNotices(broken.db, s, [approved])).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it("does nothing with no sender, which is how an environment without keys runs", async () => {
    const { db, asked } = fakeDb([sub("p1", ALICE)]);

    await pushNotices(db, null, [approved]);

    expect(asked).toEqual([]);
  });

  it("reaches at most ten devices per member, newest first", async () => {
    const many = Array.from({ length: 25 }, (_, i) => sub(`d${i}`, ALICE));
    const { db } = fakeDb(many);
    const { s, sent } = sender();

    await pushNotices(db, s, [approved]);

    expect(sent).toHaveLength(10);
    expect(sent[0].endpoint).toBe("https://push.example.test/d0");
  });
});
