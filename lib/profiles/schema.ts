import { z } from "zod";

export const MEMBER_STATUSES = [
  "unverified",
  "pending_review",
  "verified",
  "expired",
  "suspended",
] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const STRAIN_TYPES = ["indica", "sativa", "hybrid", "any"] as const;
export const CONSUMPTION_METHODS = ["flower", "vape", "edibles", "dabs", "any"] as const;

/** The signup trigger writes `member_<12 hex>` as a placeholder handle, and
 *  app/(frame)/layout.tsx reads that prefix to decide whether onboarding is finished.
 *  A member who claimed it for themselves would look permanently un-onboarded
 *  and could squat on another member's future placeholder. */
export const RESERVED_HANDLE_PREFIX = "member_";

/** Mirrors profiles_handle_format. Lowercased before validation so the form
 *  accepts "Ryder" and stores "ryder" rather than rejecting it. */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "3–20 characters: letters, numbers and underscores only.")
  .refine((value) => !value.startsWith(RESERVED_HANDLE_PREFIX), {
    message: "Handles cannot start with “member_”. Pick something else.",
  });

/** Every limit here mirrors a CHECK constraint on public.profiles. When one
 *  moves, both move — a zod schema looser than its column turns a friendly
 *  form error into a 500. */
export const profileInputSchema = z.object({
  handle: handleSchema,
  displayName: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(280, "Keep it under 280 characters.").optional(),
  city: z.string().trim().max(60).optional(),
  strainPrefs: z.array(z.enum(STRAIN_TYPES)).max(4).default([]),
  methodPrefs: z.array(z.enum(CONSUMPTION_METHODS)).max(5).default([]),
  vibeTags: z.array(z.string().trim().min(1).max(24)).max(8, "Eight tags maximum.").default([]),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

/** Everything on the profile but the handle, which has its own page and its
 *  own rules. What Settings → Edit profile saves. */
export const profileFieldsSchema = profileInputSchema.omit({ handle: true });

/** Vibe tags arrive as one comma-separated field. */
export function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export type Profile = {
  id: string;
  handle: string;
  displayName: string | null;
  bio: string | null;
  city: string | null;
  avatarUrl: string | null;
  /** Null draws the Avatar from the member id (issue #69). */
  avatarSeed: string | null;
  strainPrefs: string[];
  methodPrefs: string[];
  vibeTags: string[];
  status: MemberStatus;
  cardExpiresOn: string | null;
  attestedAt: string | null;
};

/** What another member is allowed to see. Same shape minus the card fields,
 *  so a careless spread cannot leak an expiry date into a public view. */
export type PublicProfile = Omit<Profile, "cardExpiresOn" | "attestedAt">;
