import { Banner } from "@/components/ui/banner";

/**
 * "The host changed this sesh."
 *
 * Shown to an approved guest when the pin has moved more than a mile or
 * the start time by more than an hour. What counts as a change is decided by
 * a trigger in Postgres; this only reads the stamp.
 *
 * The wording carries no date, no time and no place, and a test enforces that
 * by refusing any digit. Real notifications are step 9 of the build order.
 */
type Props = { changedAt: string | null; startsAt: string };

export function ChangedBanner({ changedAt, startsAt }: Props) {
  if (!changedAt) return null;
  // Once it has started, a warning about a change is noise.
  if (new Date(startsAt).getTime() <= Date.now()) return null;

  return (
    <Banner tone="warning">
      The host changed this sesh after you were approved. Check the time and the address again
      before you set off.
    </Banner>
  );
}
