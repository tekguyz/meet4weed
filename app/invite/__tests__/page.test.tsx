import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INVITE_FAILED } from "@/lib/sesh/invites";

const getInvitePreview = vi.fn();
const getUser = vi.fn();
const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});

vi.mock("@/lib/sesh/invite-reads", () => ({ getInvitePreview: (t: string) => getInvitePreview(t) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => redirect(to) }));
vi.mock("@/app/(frame)/seshes/invite-actions", () => ({ redeemInvite: vi.fn() }));

/** The page an invite link opens.
 *
 *  The two claims here are both about what is ABSENT, and neither was
 *  guarded before: the database seam was tested and the screen was not.
 *
 *  1. IT SHOWS THE TITLE AND THE START TIME AND NOTHING ELSE. Not the area
 *     name, not the fuzzy circle, not the host's handle, not the sesh id. A
 *     link travels further than the person it was sent to, so the page it
 *     opens tells a stranger only what they need to decide whether to press.
 *
 *  2. IT SPENDS NOTHING. The page calls the preview and never the redeem.
 *     Every chat app fetches a pasted link to draw a preview card, and one
 *     use is the default — a page that spent a use on render would be a
 *     link that died before its recipient saw it.
 *
 *  Rendered by awaiting the server component, which is what Next does.
 */
const SOURCE = readFileSync(resolve(process.cwd(), "app/invite/[token]/page.tsx"), "utf8");

const TOKEN = "PpaiTkHuLPo-OB89Ah3ZeQ.6yPmx7lbcULwWa1dDbwPCenK0GxHMYy1yKjkG5";
const STARTS = "2026-09-23T04:39:45.148Z";

async function renderPage(token = TOKEN) {
  const { default: InvitePage } = await import("@/app/invite/[token]/page");
  render(await InvitePage({ params: Promise.resolve({ token }) }));
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "member-1" } } });
  getInvitePreview.mockResolvedValue({ title: "Tuesday wind-down", startsAt: STARTS });
});

describe("a live link", () => {
  it("shows the sesh title and when it starts", async () => {
    await renderPage();

    expect(screen.getByText("Tuesday wind-down")).toBeInTheDocument();
    expect(screen.getByText(/Sep 23/)).toBeInTheDocument();
  });

  it("offers the button that spends the use", async () => {
    await renderPage();

    expect(screen.getByRole("button", { name: /use this invite/i })).toBeInTheDocument();
  });

  it("says the host still decides", async () => {
    await renderPage();

    expect(screen.getByText(/host still decides/i)).toBeInTheDocument();
  });

  /** The preview returns two fields and the page renders two fields. This
   *  asserts the page adds nothing of its own from anywhere else.
   *
   *  "The host still decides" is fixed copy and is meant to be here — what
   *  must never appear is WHICH host, so the probe is for a handle rather
   *  than for the word. */
  it("shows no area name, no circle, no host handle and no sesh id", async () => {
    await renderPage();

    const text = document.body.textContent!;
    expect(text).not.toMatch(/Ybor|neighbourhood|area name/i);
    expect(text).not.toMatch(/circle|half a mile|radius|map/i);
    // A handle: @something. Nothing on this page names a person.
    expect(text).not.toMatch(/@\w/);
    expect(text).not.toMatch(/\bhosted by\b/i);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(text).not.toContain(TOKEN);
  });

  /** The page cannot render what it is never handed. This pins the shape of
   *  the preview at the seam, so widening invite_preview() to return an area
   *  name or a host id has to come past this test. */
  it("is handed two fields and only two", async () => {
    await renderPage();

    const handed = getInvitePreview.mock.results[0].value;
    expect(Object.keys(await handed).sort()).toEqual(["startsAt", "title"]);
  });

  /** A render must never spend a use. The page has one reader and it is the
   *  one that changes nothing. */
  it("calls the preview and nothing that spends", async () => {
    await renderPage();

    expect(getInvitePreview).toHaveBeenCalledWith(TOKEN);
    expect(SOURCE).not.toMatch(/redeem_invite|redeemInvite\s*\(/);
  });
});

describe("a link that does not work", () => {
  /** Expired, used up, revoked, never existed, a flipped byte in the tag —
   *  the page is handed null for every one of them and says one thing. */
  it("renders the one sentence and no button", async () => {
    getInvitePreview.mockResolvedValue(null);

    await renderPage();

    expect(screen.getByText(INVITE_FAILED)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /use this invite/i })).not.toBeInTheDocument();
  });

  it("names no reason", async () => {
    getInvitePreview.mockResolvedValue(null);

    await renderPage();

    expect(document.body.textContent?.toLowerCase()).not.toMatch(
      /expired|used up|revoked|not found|signature|suspend/,
    );
  });
});

describe("a signed-out visitor", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: null } });
  });

  /** #31, the cold path. They are NOT bounced to sign in any more: they see
   *  the same page as everybody else, and the split happens on the press.
   *  Bouncing them first meant a stranger had to make an account before they
   *  were told what they were being invited to. */
  it("is sent nowhere", async () => {
    await renderPage();

    expect(redirect).not.toHaveBeenCalled();
  });

  /** The SAME page, not a version of it. One rendering, so there is no
   *  second one to keep in step. */
  it("sees the title, the start time and the button", async () => {
    await renderPage();

    expect(screen.getByText("Tuesday wind-down")).toBeInTheDocument();
    expect(screen.getByText(/Sep 23/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use this invite/i })).toBeInTheDocument();
  });

  it("is told nothing extra about signing up or signing in", async () => {
    await renderPage();

    const text = document.body.textContent!;
    expect(text).not.toMatch(/sign up|sign in|create an account|password/i);
  });

  /** Pressing is what splits the two paths, and pressing is a POST. The page
   *  itself never looks at who is asking, so it cannot drift. */
  it("does not ask who is asking", async () => {
    await renderPage();

    expect(SOURCE).not.toMatch(/getUser/);
  });
});

describe("the token", () => {
  /** The token is a path segment, so without this every link and every form
   *  post from this page hands a live invite to whatever it goes to. */
  it("is kept out of the Referer header", async () => {
    const { metadata } = await import("@/app/invite/[token]/page");

    expect(metadata.referrer).toBe("no-referrer");
  });
});
