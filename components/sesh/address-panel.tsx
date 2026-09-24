import { buttonClass } from "@/components/ui/button";
import type { SeshAddress } from "@/lib/sesh/queries";

/**
 * Renders the address, or the locked state. It decides neither.
 *
 * `sesh_address()` returns the address or no rows at all, and no rows IS the
 * locked state — not an error, and not something a screen works out. There is
 * deliberately no `isApproved` prop, no status, and no member id here: the day
 * one appears, the rule has left Postgres and moved into a screen, which is
 * the single thing this whole plan is built to prevent.
 */
/** Google's universal Maps link: it opens the Google Maps app on a phone that
 *  has it, and the Maps website everywhere else — one link for iPhone, Android
 *  and a laptop, with no guessing at the platform. It takes the street
 *  address, not the pin, because that is what a driver navigates to. */
function mapsHref(addressLine: string): string {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: addressLine })}`;
}

type Props = {
  address: SeshAddress | null;
  areaName: string | null;
};

export function AddressPanel({ address, areaName }: Props) {
  // A row with nothing in it is a sesh whose address the 7-day wipe has taken.
  const wiped = address !== null && address.addressLine === null;

  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface p-4">
      <h2 className="text-lg">Where</h2>

      {address && !wiped ? (
        <>
          <p className="text-base text-ink">{address.addressLine}</p>
          {address.unitNote ? <p className="text-sm text-ink">Unit or buzzer: {address.unitNote}</p> : null}
          {address.gateCode ? <p className="text-sm text-ink">Gate code: {address.gateCode}</p> : null}
          {areaName ? <p className="text-sm text-ink-muted">{areaName}</p> : null}
          <a
            href={mapsHref(address.addressLine!)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClass("quiet")} mt-2`}
          >
            Open in Maps
          </a>
          <p className="text-sm text-ink-muted">
            Keep this to yourself. It disappears twelve hours after the sesh starts.
          </p>
        </>
      ) : wiped ? (
        <p className="text-sm text-ink-muted">
          {areaName ? `${areaName}. ` : ""}
          The address is no longer stored — it is deleted seven days after a sesh.
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          {areaName ? `Somewhere in ${areaName}. ` : ""}
          The map shows a circle about half a mile across. The exact address appears once the host has
          approved you.
        </p>
      )}
    </section>
  );
}
