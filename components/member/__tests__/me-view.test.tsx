import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/member/avatar";
import { MeView } from "@/components/member/me-view";
import type { Standing } from "@/lib/member/standing";

const VERIFIED: Standing = { kind: "verified", expiresOn: "2027-03-01" };

function renderMe(props: Partial<Parameters<typeof MeView>[0]> = {}) {
  return render(
    <MeView
      memberId="m-1"
      avatarSeed={null}
      handle="ryder"
      displayName="Ryder"
      standing={VERIFIED}
      adminLink={false}
      version="0.1.0"
      {...props}
    />,
  );
}

describe("MeView (issue #65)", () => {
  it("shows the handle, the card status and the expiry date", () => {
    renderMe();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("@ryder");
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
    expect(screen.getByText(/Mar 1, 2027/)).toBeInTheDocument();
  });

  it("gives a renew path before the card lapses", () => {
    renderMe({ standing: { kind: "expiring", notice: "Your card expires Mar 1, in 5 days." } });

    expect(screen.getByRole("link", { name: "Renew" })).toHaveAttribute("href", "/verify");
  });

  it("gives a renew path once the card has lapsed", () => {
    renderMe({ standing: { kind: "expired" } });

    expect(screen.getByRole("link", { name: /renew/i })).toHaveAttribute("href", "/verify");
  });

  it("links to the member's own profile and to settings", () => {
    renderMe();

    expect(screen.getByRole("link", { name: /see your profile/i })).toHaveAttribute("href", "/m/ryder");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/me/settings");
  });

  it("links to help, terms, privacy and the community rules", () => {
    renderMe();

    for (const [name, href] of [
      ["Help", "/help"],
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
      ["Community rules", "/rules"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("shows no admin link to a member who is not an admin", () => {
    renderMe({ adminLink: false });

    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows the admin link to an admin", () => {
    renderMe({ adminLink: true });

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("offers sign out as a POST, never a link", () => {
    const { container } = renderMe();

    const form = container.querySelector('form[action="/auth/sign-out"]');
    expect(form).toHaveAttribute("method", "post");
    expect(within(form as HTMLElement).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("ends with an About line carrying the app version", () => {
    renderMe({ version: "1.2.3" });

    expect(screen.getByText(/version 1\.2\.3/i)).toBeInTheDocument();
  });
});

describe("MeView avatar (issue #69)", () => {
  it("draws the member's avatar beside the handle", () => {
    const { container } = renderMe({ memberId: "m-1", avatarSeed: "abc" });
    const { container: expected } = render(
      <Avatar seed="abc" memberId="m-1" handle="ryder" displayName="Ryder" className="size-16" />,
    );

    expect(container.querySelector("[data-avatar]")?.outerHTML).toBe(
      expected.querySelector("[data-avatar]")?.outerHTML,
    );
  });
});
