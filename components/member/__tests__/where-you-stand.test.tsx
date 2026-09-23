import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WhereYouStand } from "@/components/member/where-you-stand";

function link(name: RegExp) {
  return screen.getByRole("link", { name });
}

describe("WhereYouStand", () => {
  it("tells a pending member a person is checking", () => {
    render(<WhereYouStand standing={{ kind: "pending" }} />);

    expect(screen.getByRole("heading")).toHaveTextContent(/person is checking/i);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a rejected member the stored reason and a Help link", () => {
    render(<WhereYouStand standing={{ kind: "rejected", reason: "Card is not an OMMU card" }} />);

    expect(screen.getByText(/Card is not an OMMU card/)).toBeInTheDocument();
    expect(link(/help/i)).toHaveAttribute("href", "/help");
    expect(link(/try again/i)).toHaveAttribute("href", "/verify");
  });

  it("sends a retake straight back into the camera flow", () => {
    render(<WhereYouStand standing={{ kind: "retake", reason: "Too dark" }} />);

    expect(screen.getByText(/Too dark/)).toBeInTheDocument();
    expect(link(/retake/i)).toHaveAttribute("href", "/verify");
  });

  it("explains read-only to an expired member and offers the renew path", () => {
    render(<WhereYouStand standing={{ kind: "expired" }} />);

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(link(/renew/i)).toHaveAttribute("href", "/verify");
  });

  it("reuses the expiry banner, with Renew, when the card expires soon", () => {
    render(<WhereYouStand standing={{ kind: "expiring", notice: "Your card expires Oct 1, in 14 days." }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Your card expires Oct 1, in 14 days.");
    expect(link(/renew/i)).toHaveAttribute("href", "/verify");
  });

  it("sends an unverified member to verify, with one sentence on why", () => {
    render(<WhereYouStand standing={{ kind: "unverified" }} />);

    expect(screen.getByText(/verified patients/i)).toBeInTheDocument();
    expect(link(/verify your card/i)).toHaveAttribute("href", "/verify");
  });

  it("asks a lapsed member to take the photos again", () => {
    render(<WhereYouStand standing={{ kind: "lapsed" }} />);

    expect(screen.getByText(/deleted/i)).toBeInTheDocument();
    expect(link(/take them again/i)).toHaveAttribute("href", "/verify");
  });

  it("gives a suspended member Help and nothing else to do", () => {
    render(<WhereYouStand standing={{ kind: "suspended" }} />);

    expect(screen.getByRole("heading")).toHaveTextContent(/suspended/i);
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/help"]);
  });

  it("shows a verified member the date their card runs to", () => {
    render(<WhereYouStand standing={{ kind: "verified", expiresOn: "2027-06-01" }} />);

    expect(screen.getByText(/Jun 1, 2027/)).toBeInTheDocument();
  });
});
