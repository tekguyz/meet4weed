import { z } from "zod";
import { STRAIN_TYPES } from "@/lib/profiles/schema";

/** The on-deck list — what people are bringing.
 *
 *  Three kinds, and "none" is one of them. A member who is bringing none has
 *  a ROW, not a blank. Nothing here works that out; the database does. See
 *  supabase/migrations/…_contributions.sql.
 */
export const CONTRIBUTION_KINDS = ["strain", "item", "none"] as const;
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

/** Mirrors the per-member cap and the label length in `contributions`. When
 *  one moves, both move — a zod schema looser than its column turns a
 *  friendly form error into a 500. */
export const CONTRIBUTION_LABEL_MAX = 60;
export const CONTRIBUTIONS_PER_MEMBER = 10;

/** The copy is "bringing none", never "nothing". "Nothing" reads as a
 *  shortfall; "none" reads as a choice, and it is a choice. */
export const BRINGING_NONE = "Bringing none";

export const contributionInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("strain"),
    label: z
      .string()
      .trim()
      .min(1, "Give the strain a name.")
      .max(CONTRIBUTION_LABEL_MAX, `Keep it under ${CONTRIBUTION_LABEL_MAX} characters.`),
    strainType: z.enum(STRAIN_TYPES, { message: "Pick a strain type." }),
  }),
  z.object({
    kind: z.literal("item"),
    label: z
      .string()
      .trim()
      .min(1, "Say what you are bringing.")
      .max(CONTRIBUTION_LABEL_MAX, `Keep it under ${CONTRIBUTION_LABEL_MAX} characters.`),
  }),
  z.object({ kind: z.literal("none") }),
]);

export type ContributionInput = z.infer<typeof contributionInputSchema>;
