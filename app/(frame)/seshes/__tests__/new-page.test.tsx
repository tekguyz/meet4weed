import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/app/(frame)/seshes/actions", () => ({ createSesh: vi.fn() }));
vi.mock("@/components/sesh/sesh-form", () => ({ SeshForm: () => null }));
vi.mock("@/lib/profiles/queries", () => ({
  getMyProfile: async () => ({ status: "verified", cardExpiresOn: "2099-01-01" }),
}));

import NewSeshPage from "@/app/(frame)/seshes/new/page";

/** Issue #68, spec §2: the no-sales rule is surfaced at sesh creation. */
describe("the host-a-sesh page", () => {
  it("links the community rules next to the form", async () => {
    render(await NewSeshPage());

    expect(screen.getByRole("link", { name: /community rules/i })).toHaveAttribute("href", "/rules");
  });
});
