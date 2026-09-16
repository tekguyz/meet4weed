import { z } from "zod";

/**
 * What Claude returns for one submission (spec §4.1 step 7). Readings and
 * warnings — there is deliberately no field for a verdict. A person decides.
 */
export const CardReadingSchema = z.object({
  nameOnCard: z.string().nullable().describe("The name printed on the card, or null if it cannot be read with confidence."),
  patientId: z.string().nullable().describe("The patient or registry ID printed on the card, or null."),
  expiryDate: z.string().nullable().describe("The card's expiration date as YYYY-MM-DD, or null."),
  fieldsLegible: z.boolean().describe("True if the name, ID and expiry date can all be read with confidence."),
  typedFieldsMatch: z.boolean().describe("True only if the ID and expiry date read from the card equal what the member typed."),
  cardVisibleInFacePhoto: z.boolean().describe("True if the second image shows a person holding what looks like the same card."),
  challengeAppearsPerformed: z.boolean().describe("True if the second image shows the person doing what they were asked to do."),
  concerns: z.array(z.string()).describe("Short plain sentences a human reviewer should look at. Empty if none."),
});

export type CardReading = z.infer<typeof CardReadingSchema>;
