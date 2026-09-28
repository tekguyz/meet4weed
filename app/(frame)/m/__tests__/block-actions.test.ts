/** @vitest-environment node
 *
 *  The block action turns a database answer into a calm sentence. The wall
 *  itself is proved against the real project in
 *  supabase/tests/__tests__/block-rls.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
}));

const notify = vi.fn();
vi.mock("@/lib/notify/notify", () => ({ notify }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const MEMBER = "44444444-4444-4444-8444-444444444444";
const NO_POSTGRES_CODES = /M4W\d\d|42501|PGRST/;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function block(fd: FormData) {
  const { blockMember } = await import("@/app/(frame)/m/block-actions");
  return blockMember(null, fd);
}

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "member-1" } } });
  rpc.mockReset().mockResolvedValue({ error: null });
  notify.mockReset();
  revalidatePath.mockReset();
});

describe("blockMember", () => {
  it("asks the database to block the member it names", async () => {
    const result = await block(form({ memberId: MEMBER }));

    expect(rpc).toHaveBeenCalledWith("block_member", { p_member: MEMBER });
    expect(result.ok).toBe(true);
  });

  it("tells nobody", async () => {
    await block(form({ memberId: MEMBER }));
    expect(notify).not.toHaveBeenCalled();
  });

  it("does not revalidate the profile it is standing on, so the done card can show", async () => {
    await block(form({ memberId: MEMBER }));
    expect(revalidatePath).not.toHaveBeenCalledWith(expect.stringMatching(/^\/m\//));
  });

  it("refuses a malformed id without asking the database", async () => {
    const result = await block(form({ memberId: "not-a-uuid" }));

    expect(rpc).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it("asks a signed-out caller to sign in again", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await block(form({ memberId: MEMBER }));

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, message: "Sign in again to continue." });
  });

  it("turns M4W60 into a plain sentence", async () => {
    rpc.mockResolvedValue({ error: { code: "M4W60", message: "raised M4W60" } });
    const result = await block(form({ memberId: MEMBER }));

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Could not block that member.");
  });

  it("never shows a Postgres code, whatever comes back", async () => {
    for (const code of ["M4W60", "42501", "PGRST116", "XX000"]) {
      rpc.mockResolvedValue({ error: { code, message: `raised ${code}` } });
      const result = await block(form({ memberId: MEMBER }));
      expect(result.message).not.toMatch(NO_POSTGRES_CODES);
    }
  });
});
