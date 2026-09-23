import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HeldInvitePage from "@/app/(frame)/invite/held/page";
import { canBrowse, INVITE_HELD_BODY } from "@/lib/sesh/invites";

/** Plan 04, ticket #31 — the screen a waiting member lands on.
 *
 *  They pressed the button, the claim is a row in public.invite_claims, and
 *  private.can_browse() still refuses them the sesh because nobody has
 *  approved their card yet. Before this screen existed they were sent to
 *  /seshes/<id> and read a 404 for a sesh that was genuinely theirs.
 *
 *  It says both halves: the link is not lost, and the card review is what
 *  stands in the way. It names no sesh, because they cannot read one.
 */
describe("the held screen", () => {
  it("says the invite was saved", () => {
    render(<HeldInvitePage />);

    expect(screen.getByText(INVITE_HELD_BODY)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/held/i);
  });

  it("says a person has to check the card first", () => {
    render(<HeldInvitePage />);

    expect(document.body.textContent).toMatch(/card/i);
    expect(document.body.textContent).toMatch(/approve/i);
  });

  it("offers the way to finish verifying", () => {
    render(<HeldInvitePage />);

    expect(screen.getByRole("link", { name: /verify your card/i })).toHaveAttribute(
      "href",
      "/verify",
    );
  });

  /** They cannot read the sesh, so the screen that tells them so must not
   *  read it either. A title here would be the claim acting as a key. */
  it("names no sesh, no host and no time", () => {
    render(<HeldInvitePage />);

    const text = document.body.textContent!;
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(text).not.toMatch(/@\w/);
    expect(text).not.toMatch(/\bhosted by\b|\bstarts\b/i);
  });
});

/** The TS twin of private.can_browse. The database is what refuses; this only
 *  picks which screen is shown instead of a 404. They have to agree, or a
 *  verified member is sent to the waiting screen. */
describe("canBrowse mirrors private.can_browse", () => {
  it.each(["verified", "expired"])("lets %s read a sesh", (status) => {
    expect(canBrowse(status)).toBe(true);
  });

  it.each(["unverified", "pending_review", "suspended", ""])("refuses %s", (status) => {
    expect(canBrowse(status)).toBe(false);
  });
});
