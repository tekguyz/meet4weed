/** @vitest-environment node
 *
 *  The create action's own job: read the form, refuse what the database would
 *  refuse anyway but with words a member can act on, and send only the columns
 *  a host is allowed to write.
 *
 *  The rules themselves live in Postgres and are proved in
 *  supabase/tests/__tests__/sesh-rls.test.ts against the real project. Nothing
 *  here re-tests them — this file would pass just as happily against a
 *  database with no policies at all, which is exactly why it is not the place
 *  security is proved.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      insert: (values: unknown) => {
        insert(values);
        return { select: () => ({ single: async () => insert.mock.results.at(-1)!.value }) };
      },
    }),
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

/** Far enough ahead that the test cannot race midnight. */
function wallClock(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T20:00`;
}

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const fields: Record<string, string> = {
    title: "Friday wind-down",
    description: "Low key, bring a blanket",
    seshType: "chill",
    startsAtLocal: wallClock(3),
    capacity: "6",
    exactLat: "27.9506",
    exactLng: "-82.4572",
    addressLine: "1 Test Street",
    unitNote: "Apt 4",
    gateCode: "1234",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createSesh", () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "host-1" } } });
    insert.mockReset().mockReturnValue({ data: { id: "sesh-1" }, error: null });
    redirect.mockReset();
  });

  async function run(fd: FormData) {
    const { createSesh } = await import("@/app/seshes/actions");
    return createSesh(null, fd);
  }

  it("sends the host to their own seshes once it is saved", async () => {
    await run(form());

    expect(redirect).toHaveBeenCalledWith("/seshes/mine");
  });

  it("writes only the columns a host is granted, and never the derived ones", async () => {
    await run(form());

    const payload = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      "address_line",
      "capacity",
      "description",
      "exact_lat",
      "exact_lng",
      "gate_code",
      "host_id",
      "sesh_type",
      "starts_at",
      "title",
      "unit_note",
    ]);
  });

  it("reads the start time as Florida time rather than the server's zone", async () => {
    await run(form({ startsAtLocal: "2026-09-25T20:00" }));

    const payload = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.starts_at).toBe("2026-09-26T00:00:00.000Z");
  });

  it("refuses a sesh in the past and says which field is wrong", async () => {
    const result = await run(form({ startsAtLocal: wallClock(-2) }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.startsAtLocal).toMatch(/future/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a title that is too short", async () => {
    const result = await run(form({ title: "hi" }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.title).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a capacity outside what the column allows", async () => {
    const result = await run(form({ capacity: "99" }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.capacity).toBeTruthy();
  });

  it("refuses coordinates that are not on the planet", async () => {
    const result = await run(form({ exactLat: "512" }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.exactLat).toBeTruthy();
  });

  it("turns the database's refusal into words, never a Postgres code", async () => {
    insert.mockReturnValue({ data: null, error: { code: "42501", message: "new row violates row-level security policy" } });

    const result = await run(form());

    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(/42501|row-level|policy/i);
    expect(result.message.length).toBeGreaterThan(10);
  });

  it("refuses when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await run(form());

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
