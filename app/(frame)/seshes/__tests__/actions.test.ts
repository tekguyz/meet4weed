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
const selectOne = vi.fn();
let updateResult: unknown = { error: null };

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
            return updateResult;
          },
        };
      },
      select: () => ({ eq: () => ({ single: async () => selectOne() }) }),
    }),
  }),
}));

const areaNameFor = vi.fn();
vi.mock("@/lib/sesh/area-name", () => ({ areaNameLookup: () => areaNameFor }));

const claimSeshCreate = vi.fn();
vi.mock("@/lib/sesh/member-limits", () => ({
  memberLimitsFromEnv: () => ({ claimSeshCreate }),
}));

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
  updateResult = { error: null };
  selectOne.mockReset().mockResolvedValue({ data: { approved_count: 4 } });
  insertResult = { data: { id: "sesh-1", fuzzy_lat: 27.95312, fuzzy_lng: -82.45411 }, error: null };
  claimSeshCreate.mockReset().mockResolvedValue(true);
});

async function act(name: "createSesh" | "editSesh" | "cancelSesh", fd: FormData) {
  const actions = await import("@/app/(frame)/seshes/actions");
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
      "visibility",
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

  /** Ticket #66. The insert policy caps a host at five OPEN seshes, but a
   *  post-and-cancel loop never trips it. This counts posts. */
  it("counts the post against the host, for today", async () => {
    await act("createSesh", form());

    expect(claimSeshCreate).toHaveBeenCalledWith("host-1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("refuses whole over the daily limit, and never writes", async () => {
    claimSeshCreate.mockResolvedValue(false);

    const result = await act("createSesh", form());

    expect(result?.ok).toBe(false);
    expect(result?.message).toMatch(/tomorrow/i);
    expect(insert).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not count a form that never gets past its own checks", async () => {
    await act("createSesh", form({ title: "hi" }));

    expect(claimSeshCreate).not.toHaveBeenCalled();
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

  // The picker posts "" until a pin is dropped. Coerced, "" is 0, and 0 is on
  // the planet — so a sesh with no pin was saved at 0, 0 in the Atlantic, and
  // the feed map, which centres on the mean of every circle, went blue.
  it("refuses a sesh with no pin instead of saving it at 0, 0", async () => {
    const result = await act("createSesh", form({ exactLat: "", exactLng: "" }));

    expect(result?.fieldErrors?.exactLat).toBe("Put the pin on the map.");
    expect(result?.fieldErrors?.exactLng).toBe("Put the pin on the map.");
    expect(insert).not.toHaveBeenCalled();
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

  /** Listed is the default everywhere — in the column, in the schema and on
   *  the form. A host who never notices the question posts a public sesh,
   *  which is the behaviour every sesh had before unlisted existed. */
  it("posts a listed sesh when the host says nothing about it", async () => {
    const fd = form();
    fd.delete("visibility");

    await act("createSesh", fd);

    expect((insert.mock.calls[0][0] as Record<string, unknown>).visibility).toBe("listed");
  });

  it("posts an unlisted sesh when the host asks for one", async () => {
    await act("createSesh", form({ visibility: "unlisted" }));

    expect((insert.mock.calls[0][0] as Record<string, unknown>).visibility).toBe("unlisted");
  });

  /** The column is an enum, so a value it does not know would come back as a
   *  22P02 the member cannot act on. It is refused here instead. */
  it("refuses a visibility the column does not know", async () => {
    const result = await act("createSesh", form({ visibility: "secret" }));

    expect(result?.ok).toBe(false);
    expect(result?.fieldErrors?.visibility).toBeTruthy();
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
      "visibility",
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

  /** The database raises its own code for this so the screen can say how
   *  many people are already in. An RLS refusal would arrive as 42501,
   *  indistinguishable from every other reason a write can bounce. */
  it("says how many people are already approved when the host shrinks it too far", async () => {
    updateResult = { error: { code: "M4W16", message: "capacity below approved count" } };

    const result = await act("editSesh", editForm({ capacity: "2" }));

    expect(result?.ok).toBe(false);
    expect(result?.fieldErrors?.capacity).toContain("4");
    expect(result?.fieldErrors?.capacity).not.toMatch(/M4W16/);
  });

  it("refuses without a sesh to edit", async () => {
    const fd = form();

    const result = await act("editSesh", fd);

    expect(result?.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  /** Flipping it either way is an ordinary edit, not its own act like
   *  cancelling: nobody is evicted in either direction, so nothing here has
   *  to warn or confirm. */
  it("takes a sesh out of the feed when the host unlists it", async () => {
    await act("editSesh", editForm({ visibility: "unlisted" }));

    expect((update.mock.calls[0][0] as Record<string, unknown>).visibility).toBe("unlisted");
  });

  it("puts it back when the host lists it again", async () => {
    await act("editSesh", editForm({ visibility: "listed" }));

    expect((update.mock.calls[0][0] as Record<string, unknown>).visibility).toBe("listed");
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
