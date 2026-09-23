import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnDeck } from "@/components/sesh/on-deck";
import type { ContributionRow } from "@/lib/sesh/queries";

vi.mock("@/app/(frame)/seshes/on-deck-actions", () => ({
  addContribution: vi.fn(),
  removeContribution: vi.fn(),
}));

/** The on-deck panel renders what the database handed it and decides nothing.
 *
 *  THE PANEL TAKES NO IDENTITY. There is no `isApproved` prop, no member id
 *  and no RSVP status here, exactly as in `AddressPanel`. It cannot have one:
 *  `contributions_select` returns no rows at all to anybody the host has not
 *  approved, so AN EMPTY LIST IS ALREADY THE ANSWER. The day somebody adds
 *  `if (isApproved)` to "fix the gap", the rule has left Postgres and moved
 *  into a screen, which is the single thing this plan is built to prevent.
 *  The source scans at the bottom of this file are what stop that.
 *
 *  The empty card is deliberately one card for two cases — nobody has said
 *  yet, and you are not approved yet. The panel is not told which, so it says
 *  both and picks neither.
 */
const SOURCE = readFileSync(resolve(process.cwd(), "components/sesh/on-deck.tsx"), "utf8");
const FEED_PAGE = readFileSync(resolve(process.cwd(), "app/(frame)/seshes/page.tsx"), "utf8");

const SESH = "11111111-1111-4111-8111-111111111111";

function row(over: Partial<ContributionRow> & { id: string }): ContributionRow {
  return {
    memberId: "22222222-2222-4222-8222-222222222222",
    kind: "item",
    label: "Papers",
    strainType: null,
    handle: "ana",
    displayName: null,
    ...over,
  };
}

const STRAIN = row({ id: "a", kind: "strain", label: "Blue Dream", strainType: "sativa" });
const ITEM = row({ id: "b", kind: "item", label: "Snacks", handle: "bo" });
const NONE = row({ id: "c", kind: "none", label: null, handle: "cy" });

describe("the on-deck panel", () => {
  describe("the three states render, and they render as equals", () => {
    it("shows the empty card when it was handed no rows", () => {
      render(<OnDeck seshId={SESH} rows={[]} />);

      expect(screen.getByText(/nobody has said/i)).toBeInTheDocument();
    });

    /** The forms stay put on an empty list. An empty list is a requester AND
     *  a sesh nobody has spoken on yet, and the panel is not told which — so
     *  hiding them here would take the first word away from the first
     *  approved guest. The database refuses what it should. */
    it("keeps both forms on an empty list, so the first guest can speak", () => {
      render(<OnDeck seshId={SESH} rows={[]} />);

      expect(screen.getByLabelText(/what are you bringing/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /bringing none/i })).toBeInTheDocument();
    });

    it("shows what people are bringing", () => {
      render(<OnDeck seshId={SESH} rows={[STRAIN, ITEM]} />);
      const list = within(screen.getByRole("list"));

      expect(list.getByText("Blue Dream")).toBeInTheDocument();
      expect(list.getByText("sativa")).toBeInTheDocument();
      expect(list.getByText("Snacks")).toBeInTheDocument();
    });

    it("says bringing none, and never says nothing", () => {
      const { container } = render(<OnDeck seshId={SESH} rows={[NONE]} />);

      expect(within(screen.getByRole("list")).getByText(/bringing none/i)).toBeInTheDocument();
      expect(container.textContent ?? "").not.toMatch(/nothing/i);
    });

    /** Same size, same weight, same place. A different class list here is how
     *  "bringing none" quietly becomes a lesser answer. */
    it("gives a bringing-none card the same classes as a contribution card", () => {
      render(<OnDeck seshId={SESH} rows={[ITEM, NONE]} />);

      const [item, none] = screen.getAllByRole("listitem");
      expect(none.className).toBe(item.className);
      expect(within(none).getByText(/bringing none/i).className).toBe(
        within(item).getByText("Snacks").className,
      );
    });

    /** Never sorted to the bottom: the order is the order it was given, which
     *  is the order people spoke in. */
    it("keeps the order it was handed, so none is not pushed down the list", () => {
      render(<OnDeck seshId={SESH} rows={[NONE, ITEM]} />);

      const texts = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
      expect(texts[0]).toMatch(/bringing none/i);
      expect(texts[1]).toMatch(/Snacks/);
    });
  });

  describe("one member, one answer", () => {
    /** The database makes these exclusive — a 'none' row deletes that
     *  member's real rows and a real row deletes their 'none'. The panel must
     *  not soften that by merging, hiding or de-duplicating anything: it
     *  renders one card per row it was given, full stop. */
    it("renders exactly one card per row, and merges nothing", () => {
      const { rerender } = render(<OnDeck seshId={SESH} rows={[STRAIN, ITEM]} />);
      expect(screen.getAllByRole("listitem")).toHaveLength(2);

      rerender(<OnDeck seshId={SESH} rows={[NONE]} />);
      const list = within(screen.getByRole("list"));
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(list.queryByText("Blue Dream")).not.toBeInTheDocument();
      expect(list.getByText(/bringing none/i)).toBeInTheDocument();
    });

    /** One action each way. Saying "bringing none" is one button press, and
     *  adding a thing is one press back — no clearing step in between,
     *  because the trigger does the clearing. */
    it("offers bringing none as a single submit that carries the none kind", () => {
      render(<OnDeck seshId={SESH} rows={[]} />);

      const button = screen.getByRole("button", { name: /bringing none/i });
      const form = button.closest("form");
      expect(form).not.toBeNull();
      expect(form?.querySelector('input[name="kind"]')).toHaveValue("none");
      expect(form?.querySelector('input[name="seshId"]')).toHaveValue(SESH);
      // No label to fill in first. "Bringing none" carries nothing.
      expect(form?.querySelector("input[required]")).toBeNull();
    });

    it("offers adding a strain and adding an item from the one form", () => {
      render(<OnDeck seshId={SESH} rows={[]} />);

      expect(screen.getByRole("button", { name: /add a strain/i })).toHaveValue("strain");
      expect(screen.getByRole("button", { name: /add an item/i })).toHaveValue("item");
    });
  });

  describe("a list, not a scoreboard", () => {
    /** No totals, no per-person counts, no ranking. A count is what would
     *  turn "bringing none" into a number that goes down. */
    it("adds no number of its own to the list or its heading", () => {
      // A member may well bring "Gelato 41". That digit is theirs; the panel
      // must not add one of its own next to it.
      const named = row({ id: "d", label: "Gelato 41", handle: "dee" });
      render(<OnDeck seshId={SESH} rows={[STRAIN, ITEM, NONE, named]} />);

      const list = (screen.getByRole("list").textContent ?? "").replace("Gelato 41", "");
      expect(list).not.toMatch(/\d/);
      expect(screen.getByRole("heading", { name: /on deck/i }).textContent).not.toMatch(/\d/);
    });

    /** The only thing the panel may ask of the list is whether it is empty.
     *  Sorting would let "bringing none" be pushed down; tallying would put a
     *  number on people. */
    it("never sorts or tallies the rows it was given", () => {
      expect(SOURCE).not.toMatch(/\.sort\(|\.reduce\(|\.filter\(/);
      // A tally would have to be named and then used. The prose above may say
      // "count"; a variable called one may not exist.
      expect(SOURCE).not.toMatch(/\b(total|count|tally|rank)\w*\s*[:=(]/i);
    });

    /** A count on a feed card is a scoreboard by another name, and it would
     *  leak a sesh's insides onto a public surface. */
    it("keeps on-deck out of the feed entirely", () => {
      expect(FEED_PAGE).not.toMatch(/on-deck|onDeck|listContributions|contribution/i);
    });
  });

  describe("the rules this panel is not allowed to hold", () => {
    it("takes no identity prop of any kind", () => {
      expect(SOURCE).not.toMatch(/isApproved|approvedCount|rsvpStatus|viewerId|currentMember/);
    });

    it("never writes the word nothing", () => {
      expect(SOURCE).not.toMatch(/nothing/i);
    });

    /** Colour lives only in app/globals.css, so light and dark can swap at
     *  runtime. One inline colour breaks a theme. */
    it("writes no colour value inline", () => {
      expect(SOURCE).not.toMatch(/oklch\(|#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
    });
  });
});
