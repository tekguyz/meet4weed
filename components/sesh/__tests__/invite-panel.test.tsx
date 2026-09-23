import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvitePanel } from "@/components/sesh/invite-panel";
import type { InviteRow } from "@/lib/sesh/invite-reads";
import { CLAIMED_NOT_YET, INVITES_PER_SESH } from "@/lib/sesh/invites";

vi.mock("@/app/(frame)/seshes/invite-actions", () => ({
  mintInvite: vi.fn(),
  revokeInvite: vi.fn(),
}));

/** The host's invite panel.
 *
 *  Two claims are under test, and both of them are about what is ABSENT.
 *
 *  1. THE CLAIMANT'S VERIFICATION STATUS APPEARS NOWHERE — not in the page,
 *     and not in the payload the page is handed. "claimed, not yet able to
 *     join" is one derived state with several possible causes, and a host
 *     needs none of them. The source scans at the bottom are what stop
 *     somebody adding `if (status === "pending_review")` later.
 *
 *  2. THE TOKEN APPEARS NOWHERE. `authenticated` holds no SELECT grant on
 *     invites.token_hash, so the panel could not rebuild a link even if it
 *     tried — these tests say that the props do not carry one either.
 */
const SOURCE = readFileSync(resolve(process.cwd(), "components/sesh/invite-panel.tsx"), "utf8");
const READS = readFileSync(resolve(process.cwd(), "lib/sesh/invite-reads.ts"), "utf8");

const SESH = "11111111-1111-4111-8111-111111111111";

function invite(over: Partial<InviteRow> = {}): InviteRow {
  return {
    id: "aaaaaaaa-1111-4111-8111-111111111111",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    maxUses: 1,
    useCount: 0,
    revokedAt: null,
    live: true,
    claimCount: 0,
    waitingCount: 0,
    ...over,
  };
}

describe("a claim the host cannot act on yet", () => {
  it("says only that somebody claimed and cannot join yet", () => {
    render(<InvitePanel seshId={SESH} invites={[invite({ useCount: 1, claimCount: 1, waitingCount: 1 })]} />);

    expect(screen.getByText(CLAIMED_NOT_YET)).toBeInTheDocument();
  });

  /** Three causes, one sentence. A host reading this page must not be able to
   *  work out which one it is. */
  it("never puts a verification word on the page", () => {
    render(<InvitePanel seshId={SESH} invites={[invite({ useCount: 1, claimCount: 1, waitingCount: 1 })]} />);

    expect(document.body.textContent?.toLowerCase()).not.toMatch(
      /unverified|pending|under review|card expired|suspend/,
    );
  });

  it("shows one line per waiting claim", () => {
    render(<InvitePanel seshId={SESH} invites={[invite({ maxUses: 3, useCount: 3, claimCount: 3, waitingCount: 2 })]} />);

    expect(screen.getAllByText(CLAIMED_NOT_YET)).toHaveLength(2);
  });

  /** Somebody the host already sees in the queue is not repeated here. The
   *  sentence is for people the host has NOT met yet. */
  it("says nothing when every claimant is already in the queue", () => {
    render(<InvitePanel seshId={SESH} invites={[invite({ useCount: 1, claimCount: 1, waitingCount: 0 })]} />);

    expect(screen.queryByText(CLAIMED_NOT_YET)).not.toBeInTheDocument();
  });
});

describe("what a host can read about a link", () => {
  it("counts the uses", () => {
    render(<InvitePanel seshId={SESH} invites={[invite({ maxUses: 5, useCount: 2 })]} />);

    expect(screen.getByText("2 of 5 used")).toBeInTheDocument();
  });

  /** Revoking changes what happens NEXT and evicts nobody. The wording is the
   *  contract, because before notifications ship in Plan 05 a host has no
   *  other way to learn that. */
  it("says a revoked link evicts nobody", () => {
    render(
      <InvitePanel
        seshId={SESH}
        invites={[invite({ live: false, useCount: 1, revokedAt: new Date().toISOString() })]}
      />,
    );

    expect(screen.getByText(/still coming/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
  });

  it("offers a revoke button on a live link", () => {
    render(<InvitePanel seshId={SESH} invites={[invite()]} />);

    expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument();
  });

  it("stops the host at five live links", () => {
    const live = Array.from({ length: INVITES_PER_SESH }, (_, i) => invite({ id: `id-${i}` }));
    render(<InvitePanel seshId={SESH} invites={live} />);

    expect(screen.getByRole("button", { name: /make a link/i })).toBeDisabled();
  });

  it("lets the host make one when a link has been revoked", () => {
    const rows = [
      ...Array.from({ length: INVITES_PER_SESH - 1 }, (_, i) => invite({ id: `id-${i}` })),
      invite({ id: "dead", live: false, revokedAt: new Date().toISOString() }),
    ];
    render(<InvitePanel seshId={SESH} invites={rows} />);

    expect(screen.getByRole("button", { name: /make a link/i })).toBeEnabled();
  });

  it("says the host still decides", () => {
    render(<InvitePanel seshId={SESH} invites={[]} />);

    expect(screen.getByText(/you still decide/i)).toBeInTheDocument();
  });
});

describe("the source holds the line", () => {
  /** The panel is handed counts and dates. The day somebody adds a status to
   *  InviteRow to "help the host chase people", this goes red. */
  it("the payload carries no verification status", () => {
    expect(READS).not.toMatch(/\bstatus\b/);
    expect(READS).not.toMatch(/member_status|card_expires_on|verifications/);
  });

  /** invite-reads.ts must never name the column. Naming it would fail the
   *  whole query with 42501 anyway — this says so out loud. */
  it("nothing reads the token hash", () => {
    expect(READS).not.toContain("token_hash,");
    expect(SOURCE).not.toContain("token_hash");
    expect(SOURCE).not.toContain("tokenHash");
  });

  /** The link is shown once, from the mint reply, and never re-fetched.
   *  There is nowhere to re-fetch it from. */
  it("the panel gets a url only from a mint", () => {
    expect(SOURCE).toContain("state.url");
    expect(SOURCE).not.toMatch(/invite\.url|invite\.token/);
  });
});
