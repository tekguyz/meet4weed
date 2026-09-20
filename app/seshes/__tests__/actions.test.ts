/** @vitest-environment node
 *
 *  The actions' own job: read the form, refuse what the database would refuse
 *  anyway but with words a member can act on, send only the columns a host is
 *  allowed to write, and fill in the area name.
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
const update = vi.fn();
const eq = vi.fn();

/** What the insert hands back: the circle the trigger just worked out. */
let insertResult: unknown = {
  data: { id: "sesh-1", fuzzy_lat: 27.95312, fuzzy_lng: -82.45411 },
  error: null,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      insert: (values: unknown) => {
        insert(values);
        return { select: () => ({ single: async () => insertResult }) };
      },
      update: (values: unknown) => {
        update(values);
        return {
          eq: async (column: string, value: string) => {
            eq(column, value);
            return { error: null };
          },
        };
      },
    }),
  }),
}));

const areaNameFor = vi.fn();
vi.mock("@/lib/sesh/area-name", () => ({ areaNameLookup: () => areaNameFor }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

/** Far enough ahead that the test cannot race midnight. */
function wallClock(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T20:00`;
}

const EXACT = { lat: 27.9506, lng: -82.4572 };

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const fields: Record<string, string> = {
    title: "Friday wind-down",
    description: "Low key, bring a blanket",
    seshType: "chill",
    startsAtLocal: wallClock(3),
    capacity: "6",
    exactLat: String(EXACT.lat),
    exactLng: String(EXACT.lng),
    addressLine: "1 Test Street",
    unitNote: "Apt 4",
    gateCode: "1234",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.resetModules();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "host-1" } } });
  insert.mockReset();
  update.mockReset();
  eq.mockReset();
  redirect.mockReset();
  areaNameFor.mockReset().mockResolvedValue("Riverside");
  insertResult = { data: { id: "sesh-1", fuzzy_lat: 27.95312, fuzzy_lng: -82.45411 }, error: null };
});

async function act(name: "createSesh" | "editSesh" | "cancelSesh", fd: FormData) {
  const actions = await import("@/app/seshes/actions");
  return actions[name](null, fd);
}

describe("createSesh", () => {
  it("sends the host to their own seshes once it is saved", async () => {
    await act("createSesh", form());

    expect(redirect).toHaveBeenCalledWith("/seshes/mine");
  });

  it("writes only the columns a host is granted, and never the derived ones", async () => {
    await act("createSesh", form());

    expect(Object.keys(insert.mock.calls[0][0] as object).sort()).toEqual([
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
    await act("createSesh", form({ startsAtLocal: "2026-09-25T20:00" }));

    expect((insert.mock.calls[0][0] as Record<string, unknown>).starts_at).toBe("2026-09-26T00:00:00.000Z");
  });

  /** The one that matters. The lookup goes to a third party, so it must be
   *  handed the circle the trigger drew, never the address the host typed. */
  it("looks the area name up from the fuzzy point, never from the address", async () => {
    await act("createSesh", form());

    expect(areaNameFor).toHaveBeenCalledWith({ lat: 27.95312, lng: -82.45411 });
    const asked = JSON.stringify(areaNameFor.mock.calls[0][0]);
    expect(asked).not.toContain(String(EXACT.lat));
    expect(asked).not.toContain(String(EXACT.lng));
  });

  it("saves the name it found", async () => {
    await act("createSesh", form());

    expect(update).toHaveBeenCalledWith({ area_name: "Riverside" });
    expect(eq).toHaveBeenCalledWith("id", "sesh-1");
  });

  it("still posts the sesh when the lookup finds nothing", async () => {
    areaNameFor.mockResolvedValue(null);

    await act("createSesh", form());

    expect(update).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/seshes/mine");
  });

  it("still posts the sesh when the lookup falls over", async () => {
    areaNameFor.mockRejectedValue(new Error("nominatim unreachable"));

    await act("createSesh", form());

    expect(redirect).toHaveBeenCalledWith("/seshes/mine");
  });

  it("refuses a sesh in the past and says which field is wrong", async () => {
    const result = await act("createSesh", form({ startsAtLocal: wallClock(-2) }));

    expect(result?.ok).toBe(false);
    expect(result?.fieldErrors?.startsAtLocal).toMatch(/future/i);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a title that is too short", async () => {
    const result = await act("createSesh", form({ title: "hi" }));

    expect(result?.ok).toBe(false);
    expect(result?.fieldErrors?.title).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a capacity outside what the column allows", async () => {
    const result = await act("createSesh", form({ capacity: "99" }));

    expect(result?.fieldErrors?.capacity).toBeTruthy();
  });

  it("refuses coordinates that are not on the planet", async () => {
    const result = await act("createSesh", form({ exactLat: "512" }));

    expect(result?.fieldErrors?.exactLat).toBeTruthy();
  });

  it("refuses an area name long enough to hide a street in", async () => {
    const result = await act("createSesh", form({ areaName: "1600 Pennsylvania Avenue Northwest, Washington" }));

    expect(result?.fieldErrors?.areaName).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  it("uses the host's own area name instead of asking anybody", async () => {
    await act("createSesh", form({ areaName: "South Tampa" }));

    expect(areaNameFor).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ area_name: "South Tampa" });
  });

  it("turns the database's refusal into words, never a Postgres code", async () => {
    insertResult = { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };

    const result = await act("createSesh", form());

    expect(result?.ok).toBe(false);
    expect(result?.message).not.toMatch(/42501|row-level|policy/i);
  });

  it("refuses when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await act("createSesh", form());

    expect(result?.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("editSesh", () => {
  function editForm(overrides: Record<string, string> = {}): FormData {
    const fd = form(overrides);
    fd.set("id", "11111111-1111-4111-8111-111111111111");
    return fd;
  }

  it("writes only the columns a host is granted", async () => {
    await act("editSesh", editForm());

    expect(Object.keys(update.mock.calls[0][0] as object).sort()).toEqual([
      "address_line",
      "area_name",
      "capacity",
      "description",
      "exact_lat",
      "exact_lng",
      "gate_code",
      "sesh_type",
      "starts_at",
      "title",
      "unit_note",
    ]);
  });

  it("never lets an edit touch the status, because cancelling is its own act", async () => {
    await act("editSesh", editForm());

    expect(update.mock.calls[0][0]).not.toHaveProperty("status");
  });

  it("refuses moving a sesh into the past", async () => {
    const result = await act("editSesh", editForm({ startsAtLocal: wallClock(-1) }));

    expect(result?.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses without a sesh to edit", async () => {
    const fd = form();

    const result = await act("editSesh", fd);

    expect(result?.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("cancelSesh", () => {
  function cancelForm(id = "11111111-1111-4111-8111-111111111111"): FormData {
    const fd = new FormData();
    fd.set("id", id);
    return fd;
  }

  it("cancels the sesh and sends the host back to their list", async () => {
    await act("cancelSesh", cancelForm());

    expect(update).toHaveBeenCalledWith({ status: "cancelled" });
    expect(redirect).toHaveBeenCalledWith("/seshes/mine");
  });

  /** There is no un-cancel anywhere: cancelling locks the address at once,
   *  and handing it back to a guest list that has moved on is the thing this
   *  whole plan exists to stop. */
  it("only ever writes cancelled, never open", async () => {
    await act("cancelSesh", cancelForm());

    expect(update.mock.calls[0][0]).toEqual({ status: "cancelled" });
  });

  it("refuses without a sesh to cancel", async () => {
    const result = await act("cancelSesh", new FormData());

    expect(result?.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
