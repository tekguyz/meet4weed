import { describe, expect, it } from "vitest";
import {
  CONTRIBUTION_LABEL_MAX,
  contributionInputSchema,
} from "@/lib/sesh/on-deck";

/** The form guard, not the security boundary.
 *
 *  Every rule here mirrors a CHECK constraint on public.contributions, and
 *  the database is what actually refuses a bad row — proved in
 *  supabase/tests/__tests__/on-deck-rls.test.ts. This file exists so a member
 *  gets a sentence instead of a 500, and so the two limits cannot drift
 *  apart unnoticed.
 */
describe("what a member may put on the on-deck list", () => {
  it("takes a strain with a name and a type", () => {
    const parsed = contributionInputSchema.parse({
      kind: "strain",
      label: "Blue Dream",
      strainType: "sativa",
    });

    expect(parsed).toEqual({ kind: "strain", label: "Blue Dream", strainType: "sativa" });
  });

  it("refuses a strain with no type, because the database does", () => {
    const parsed = contributionInputSchema.safeParse({ kind: "strain", label: "Blue Dream" });

    expect(parsed.success).toBe(false);
  });

  it("takes an item and drops a strain type it was sent by mistake", () => {
    const parsed = contributionInputSchema.parse({
      kind: "item",
      label: "Papers",
      strainType: "indica",
    });

    expect(parsed).toEqual({ kind: "item", label: "Papers" });
  });

  it("trims a label, so the length limit counts real characters", () => {
    const parsed = contributionInputSchema.parse({
      kind: "item",
      label: `   ${"x".repeat(CONTRIBUTION_LABEL_MAX)}   `,
    });

    expect(parsed).toEqual({ kind: "item", label: "x".repeat(CONTRIBUTION_LABEL_MAX) });
  });

  it("refuses a label longer than the column takes", () => {
    const parsed = contributionInputSchema.safeParse({
      kind: "item",
      label: "x".repeat(CONTRIBUTION_LABEL_MAX + 1),
    });

    expect(parsed.success).toBe(false);
  });

  it("refuses a label of only spaces", () => {
    const parsed = contributionInputSchema.safeParse({ kind: "item", label: "    " });

    expect(parsed.success).toBe(false);
  });

  /** "Bringing none" is an answer, not an empty row. It carries nothing. */
  it("takes a bringing-none answer with no label and no strain type", () => {
    const parsed = contributionInputSchema.parse({ kind: "none" });

    expect(parsed).toEqual({ kind: "none" });
  });

  it("refuses a kind the database has never heard of", () => {
    const parsed = contributionInputSchema.safeParse({ kind: "vibes", label: "good ones" });

    expect(parsed.success).toBe(false);
  });
});
