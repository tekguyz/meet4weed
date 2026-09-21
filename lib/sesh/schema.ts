import { z } from "zod";

export const SESH_TYPES = [
  "chill",
  "smoke_circle",
  "movie_night",
  "game_night",
  "outdoors",
  "creative",
] as const;
export type SeshType = (typeof SESH_TYPES)[number];

/** What a member reads. `smoke_circle` is a Postgres enum value; "Smoke
 *  circle" is not. Six fit a phone-width chip row. */
export const SESH_TYPE_LABELS: Record<SeshType, string> = {
  chill: "Chill",
  smoke_circle: "Smoke circle",
  movie_night: "Movie night",
  game_night: "Game night",
  outdoors: "Outdoors",
  creative: "Creative",
};

export const SESH_TYPE_OPTIONS = SESH_TYPES.map((value) => ({
  value,
  label: SESH_TYPE_LABELS[value],
}));

export const SESH_STATUSES = ["open", "cancelled"] as const;
export type SeshStatus = (typeof SESH_STATUSES)[number];

/** Mirrors the public.sesh_visibility enum. `listed` is first because it is
 *  the default in the column, in the schema below and on the form — a host
 *  who never reads the question posts a public sesh, exactly as every sesh
 *  behaved before unlisted existed. */
export const SESH_VISIBILITIES = ["listed", "unlisted"] as const;
export type SeshVisibility = (typeof SESH_VISIBILITIES)[number];

/** Nothing here enforces anything. Who can see an unlisted sesh is decided by
 *  the seshes_select policy and nowhere else — see
 *  supabase/migrations/…_sesh_visibility.sql. This is the wording only. */
export const SESH_VISIBILITY_LABELS: Record<SeshVisibility, string> = {
  listed: "Anyone can find it",
  unlisted: "Only people you send it to",
};

export const SESH_VISIBILITY_OPTIONS = SESH_VISIBILITIES.map((value) => ({
  value,
  label: SESH_VISIBILITY_LABELS[value],
}));

/** Every limit here mirrors a CHECK constraint on public.seshes. When one
 *  moves, both move — a zod schema looser than its column turns a friendly
 *  form error into a 500. */
export const seshInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give it a name of at least 3 characters.")
    .max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(1000, "Keep it under 1000 characters.").optional(),
  seshType: z.enum(SESH_TYPES, { message: "Pick a type." }),
  /** Defaulted rather than required. A form that loses this field must post a
   *  listed sesh, never fail — and `listed` is what the column would have
   *  given it anyway. */
  visibility: z.enum(SESH_VISIBILITIES, { message: "Pick who can find it." }).default("listed"),
  /** A `datetime-local` value. Always read as Florida time — see
   *  floridaWallClockToInstant in lib/dates.ts. */
  startsAtLocal: z.string().trim().min(1, "Say when it starts."),
  capacity: z.coerce
    .number()
    .int("Whole people only.")
    .min(1, "Room for at least one guest.")
    .max(50, "Fifty guests is the most this app will take."),
  // The host drops a pin; these come from it. A member should never see these
  // messages, so they name the pin rather than the numbers.
  exactLat: z.coerce.number().min(-90, "Put the pin on the map.").max(90, "Put the pin on the map."),
  exactLng: z.coerce.number().min(-180, "Put the pin on the map.").max(180, "Put the pin on the map."),
  addressLine: z
    .string()
    .trim()
    .min(1, "Approved guests need a street address.")
    .max(200, "Keep the address under 200 characters."),
  unitNote: z.string().trim().max(60, "Keep it under 60 characters.").optional(),
  gateCode: z.string().trim().max(40, "Keep it under 40 characters.").optional(),
  /** Mirrors seshes_area_name_length. Usually filled in by the lookup; a host
   *  can overwrite it. The limit is the backstop for pasting a street into a
   *  field the whole app can read. */
  areaName: z
    .string()
    .trim()
    .max(40, "That looks like an address. A neighbourhood name is enough.")
    .optional(),
});

export type SeshInput = z.infer<typeof seshInputSchema>;
