/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc: (name: string, args: unknown) => rpc(name, args),
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq };
      },
    }),
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The real redirect() throws to unwind the request. Here it is a spy, so the
// assertion is "the flow ended by going home", not "an exception happened".
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));

describe("recordAttestation", () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    update.mockReset();
    eq.mockReset().mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  function allBoxes() {
    const fd = new FormData();
    fd.set("age", "on");
    fd.set("resident", "on");
    fd.set("card", "on");
    fd.set("noSales", "on");
    return fd;
  }

  it("records the timestamp when every box is ticked", async () => {
    const { recordAttestation } = await import("@/app/onboarding/actions");

    const result = await recordAttestation(null, allBoxes());

    expect(result.ok).toBe(true);
    expect(update.mock.calls[0][0]).toHaveProperty("attested_at");
  });

  // Issue #68. One statement, so there is never a member who attested with no
  // record of which terms they agreed to.
  it("records the current terms version in the same statement as the timestamp", async () => {
    const { TERMS_VERSION } = await import("@/lib/legal/terms");
    const { recordAttestation } = await import("@/app/onboarding/actions");

    await recordAttestation(null, allBoxes());

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ terms_version: TERMS_VERSION });
    expect(update.mock.calls[0][0]).toHaveProperty("attested_at");
  });

  it("refuses when the no-sales box is unticked", async () => {
    const fd = allBoxes();
    fd.delete("noSales");
    const { recordAttestation } = await import("@/app/onboarding/actions");

    const result = await recordAttestation(null, fd);

    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses when the age box is unticked", async () => {
    const fd = allBoxes();
    fd.delete("age");
    const { recordAttestation } = await import("@/app/onboarding/actions");

    const result = await recordAttestation(null, fd);

    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { recordAttestation } = await import("@/app/onboarding/actions");

    const result = await recordAttestation(null, allBoxes());

    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("saveProfile", () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    update.mockReset();
    eq.mockReset().mockResolvedValue({ error: null });
    rpc.mockReset().mockResolvedValue({ error: null });
    redirect.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("saves a valid profile in snake_case columns", async () => {
    const fd = new FormData();
    fd.set("handle", "Ryder");
    fd.set("displayName", "Ryder");
    fd.set("bio", "Indica after 8pm.");
    fd.set("city", "Wilton Manors");
    fd.append("strainPrefs", "indica");
    fd.append("methodPrefs", "flower");
    fd.set("vibeTags", "vinyl, board games");

    const { saveProfile } = await import("@/app/onboarding/actions");
    await saveProfile(null, fd);

    expect(update.mock.calls[0][0]).toMatchObject({
      display_name: "Ryder",
      strain_prefs: ["indica"],
      vibe_tags: ["vinyl", "board games"],
    });
    expect(rpc).toHaveBeenCalledWith("change_handle", { p_handle: "ryder" });
  });

  // Issue #70. UPDATE on handle is revoked from members, so naming it would
  // fail the whole statement with 42501 and onboarding would never finish.
  it("never writes handle directly — it goes through change_handle", async () => {
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    await saveProfile(null, fd);

    expect(update.mock.calls[0][0]).not.toHaveProperty("handle");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  // The handle goes last. Onboarding counts as finished once the placeholder
  // is gone, so the fields must already be saved by then.
  it("does not change the handle when the fields did not save", async () => {
    eq.mockResolvedValue({ error: { code: "XX000", message: "boom" } });
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    const result = await saveProfile(null, fd);

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends the member home rather than leaving them on the finished form", async () => {
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    await saveProfile(null, fd);

    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("does not redirect when the handle change was refused", async () => {
    rpc.mockResolvedValue({ error: { code: "M4W30", message: "that handle is taken" } });
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    await saveProfile(null, fd);

    expect(redirect).not.toHaveBeenCalled();
  });

  it("never sends status or card_expires_on, which the column grant forbids", async () => {
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    await saveProfile(null, fd);

    const written = update.mock.calls[0][0] as Record<string, unknown>;
    expect(written).not.toHaveProperty("status");
    expect(written).not.toHaveProperty("card_expires_on");
  });

  it("returns a field error for a bad handle instead of throwing", async () => {
    const fd = new FormData();
    fd.set("handle", "no");

    const { saveProfile } = await import("@/app/onboarding/actions");
    const result = await saveProfile(null, fd);

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.handle).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects the reserved member_ prefix", async () => {
    const fd = new FormData();
    fd.set("handle", "member_abc123def456");

    const { saveProfile } = await import("@/app/onboarding/actions");
    const result = await saveProfile(null, fd);

    expect(result.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("explains a taken handle in plain language", async () => {
    rpc.mockResolvedValue({ error: { code: "M4W30", message: "that handle is taken" } });
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    const result = await saveProfile(null, fd);

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.handle).toMatch(/taken/i);
  });

  it("explains a locked handle in plain language", async () => {
    rpc.mockResolvedValue({ error: { code: "M4W31", message: "given up recently" } });
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    const result = await saveProfile(null, fd);

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.handle).toMatch(/given up/i);
  });

  it("does not leak a raw Postgres message on an unexpected error", async () => {
    eq.mockResolvedValue({ error: { code: "42P01", message: 'relation "profiles" does not exist' } });
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    const result = await saveProfile(null, fd);

    expect(result.ok).toBe(false);
    expect(result.message).not.toMatch(/relation/i);
  });
});
