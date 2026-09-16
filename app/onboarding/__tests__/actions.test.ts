/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const update = vi.fn();
const eq = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
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
      handle: "ryder",
      display_name: "Ryder",
      strain_prefs: ["indica"],
      vibe_tags: ["vinyl", "board games"],
    });
  });

  it("sends the member home rather than leaving them on the finished form", async () => {
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    await saveProfile(null, fd);

    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("does not redirect when the save failed", async () => {
    eq.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
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
    eq.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const fd = new FormData();
    fd.set("handle", "ryder");

    const { saveProfile } = await import("@/app/onboarding/actions");
    const result = await saveProfile(null, fd);

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.handle).toMatch(/taken/i);
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
