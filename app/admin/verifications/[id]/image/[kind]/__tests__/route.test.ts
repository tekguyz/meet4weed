/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptImage } from "@/lib/verification/image-crypto";

const SECRET = Buffer.alloc(32, 5).toString("base64");
const PLAIN = Buffer.from("synthetic jpeg bytes");

const state = vi.hoisted(() => ({ admin: false, downloads: 0, doc: { storage_path: "m/v/card.bin" } as object | null }));

vi.mock("@/lib/admin/queries", () => ({ amIAdmin: async () => state.admin }));
vi.mock("@/lib/server-env", () => ({ serverEnv: () => ({ VERIFICATION_SECRET: SECRET }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.doc }) }) }) }) }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        download: async () => {
          state.downloads += 1;
          return { data: new Blob([new Uint8Array(encryptImage(SECRET, PLAIN))]), error: null };
        },
      }),
    },
  }),
}));

import { GET } from "@/app/admin/verifications/[id]/image/[kind]/route";

const call = (kind: string) =>
  GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "v1", kind }) });

beforeEach(() => Object.assign(state, { admin: false, downloads: 0, doc: { storage_path: "m/v/card.bin" } }));

describe("image route", () => {
  it("is a 404 to anyone who is not an admin, and downloads nothing", async () => {
    expect((await call("card")).status).toBe(404);
    expect(state.downloads).toBe(0);
  });

  it("decrypts and streams the image to an admin, uncached", async () => {
    state.admin = true;
    const response = await call("card");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await response.arrayBuffer()).equals(PLAIN)).toBe(true);
  });

  it("refuses a kind that does not exist", async () => {
    state.admin = true;
    expect((await call("selfie")).status).toBe(404);
    expect(state.downloads).toBe(0);
  });

  it("is a 404 once the images were deleted", async () => {
    state.admin = true;
    state.doc = null;
    expect((await call("card")).status).toBe(404);
  });
});
