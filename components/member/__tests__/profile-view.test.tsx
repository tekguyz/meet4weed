import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HandleLink, profilePath } from "@/components/member/handle-link";
import { ProfileView } from "@/components/member/profile-view";
import type { PublicProfile } from "@/lib/profiles/schema";

const RYDER: PublicProfile = {
  id: "5f0c1d2e-0000-4000-8000-000000000001",
  handle: "ryder",
  displayName: "Ryder",
  bio: "Porch sits and old records.",
  city: "Tampa",
  avatarUrl: null,
  strainPrefs: ["indica", "hybrid"],
  methodPrefs: ["flower"],
  vibeTags: ["chill", "vinyl"],
  status: "verified",
};

describe("ProfileView", () => {
  it("shows the handle, display name, bio and city", () => {
    render(<ProfileView profile={RYDER} isMe={false} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("@ryder");
    expect(screen.getByText("Ryder")).toBeInTheDocument();
    expect(screen.getByText("Porch sits and old records.")).toBeInTheDocument();
    expect(screen.getByText("Tampa")).toBeInTheDocument();
  });

  it("lists strain preferences, consumption methods and vibe tags", () => {
    render(<ProfileView profile={RYDER} isMe={false} />);

    for (const value of ["indica", "hybrid", "flower", "chill", "vinyl"]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  // A list of where someone went is a guest list. The view takes no seshes,
  // and nothing on it may read as a history.
  it("never mentions seshes hosted or attended", () => {
    const { container } = render(<ProfileView profile={RYDER} isMe={false} />);

    expect(container.textContent).not.toMatch(/sesh|hosted|attended/i);
  });

  it("leaves out the sections a member never filled in", () => {
    const bare: PublicProfile = {
      ...RYDER,
      displayName: null,
      bio: null,
      city: null,
      strainPrefs: [],
      methodPrefs: [],
      vibeTags: [],
    };
    render(<ProfileView profile={bare} isMe={false} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("@ryder");
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("tells a member looking at their own profile that this is what others see", () => {
    render(<ProfileView profile={RYDER} isMe />);

    expect(screen.getByText(/how other members see you/i)).toBeInTheDocument();
  });

  it("does not say so on somebody else's", () => {
    render(<ProfileView profile={RYDER} isMe={false} />);

    expect(screen.queryByText(/how other members see you/i)).not.toBeInTheDocument();
  });

  it("never shows the card status", () => {
    const { container } = render(<ProfileView profile={RYDER} isMe={false} />);

    expect(container.textContent).not.toMatch(/verified/i);
  });
});

describe("HandleLink", () => {
  it("links a handle to its profile", () => {
    render(<HandleLink handle="ryder" />);

    expect(screen.getByRole("link", { name: "@ryder" })).toHaveAttribute("href", "/m/ryder");
  });
});

describe("profilePath", () => {
  it("is /m/<handle>", () => {
    expect(profilePath("ryder")).toBe("/m/ryder");
  });
});
