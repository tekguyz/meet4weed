import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/profiles/schema";

const updateProfile = vi.fn();
vi.mock("@/app/(frame)/me/settings/actions", () => ({
  updateProfile: (...a: unknown[]) => updateProfile(...a),
}));

import { EditProfileForm } from "@/components/member/edit-profile-form";

const PROFILE: Profile = {
  id: "user-1",
  handle: "ryder",
  displayName: "Ryder",
  bio: "Indica after 8pm.",
  city: "Wilton Manors",
  avatarUrl: null,
  avatarSeed: null,
  strainPrefs: ["indica"],
  methodPrefs: [],
  vibeTags: ["vinyl"],
  status: "verified",
  cardExpiresOn: "2027-03-01",
  attestedAt: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  updateProfile.mockReset().mockResolvedValue({ ok: true, message: "Profile saved." });
});

describe("EditProfileForm (issue #65)", () => {
  it("starts from the member's current profile, with no handle field", () => {
    render(<EditProfileForm profile={PROFILE} />);

    expect(screen.getByLabelText("Display name")).toHaveValue("Ryder");
    expect(screen.getByLabelText("Bio")).toHaveValue("Indica after 8pm.");
    expect(screen.getByLabelText("Vibe tags")).toHaveValue("vinyl");
    expect(screen.getByRole("checkbox", { name: "indica" })).toBeChecked();
    expect(screen.queryByLabelText("Handle")).not.toBeInTheDocument();
  });

  it("shows the shared banner once it saves", async () => {
    render(<EditProfileForm profile={PROFILE} />);
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved.");
  });

  it("puts a field's error under that field", async () => {
    updateProfile.mockResolvedValue({
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { vibeTags: "Eight tags maximum." },
    });
    render(<EditProfileForm profile={PROFILE} />);
    await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Eight tags maximum.");
    expect(screen.getByRole("status")).toHaveTextContent("Check the highlighted fields.");
  });
});
