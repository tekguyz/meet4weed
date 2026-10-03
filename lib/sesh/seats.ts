/** Above this many seats a card draws a bar, not one dot per seat. */
export const DOT_LIMIT = 12;

type Common = {
  taken: number;
  capacity: number;
  full: boolean;
  /** What a screen reader hears: "3 of 6 seats taken". */
  sentence: string;
};

export type Seats =
  | (Common & { kind: "dots"; /** One per seat; true is taken. Taken first. */ dots: boolean[] })
  | (Common & { kind: "bar"; /** Shown beside the bar: "18 of 40". */ count: string });

/**
 * How a sesh card draws its room filling up (#125). Counts only: the seats
 * never carry a name or a face, because the guest list is hidden from
 * everyone but the Host and approved guests.
 *
 * `approved` is clamped into 0…capacity, so a Host who lowers Capacity below
 * the guests already in never makes the card draw more seats taken than exist.
 */
export function seats(capacity: number, approved: number): Seats {
  const taken = Math.min(Math.max(approved, 0), capacity);
  const full = taken >= capacity;
  const sentence = `${taken} of ${capacity} seat${capacity === 1 ? "" : "s"} taken${full ? ". Full." : ""}`;
  const common = { taken, capacity, full, sentence };

  if (capacity <= DOT_LIMIT) {
    return { ...common, kind: "dots", dots: Array.from({ length: capacity }, (_, i) => i < taken) };
  }
  return { ...common, kind: "bar", count: `${taken} of ${capacity}` };
}
