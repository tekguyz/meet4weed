"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { FeedPage } from "@/components/frame/page-shape";
import { FeedMap } from "@/components/sesh/feed-map";
import { SeshCard } from "@/components/sesh/sesh-card";
import type { FeedView } from "@/lib/sesh/feed-filters";
import type { FeedSesh } from "@/lib/sesh/queries";

type Props = {
  seshes: FeedSesh[];
  view: FeedView;
  viewerId: string;
  /** ISO time the server rendered at; see SeshCard. */
  now: string;
  /** Server-rendered parts above and below the list: title, controls, paging. */
  header: ReactNode;
  footer: ReactNode;
  /** Shown in place of the list when there is nothing on. No map then. */
  empty?: ReactNode;
};

/** Tailwind's `lg`, the laptop step (DESIGN.md, Layout). */
const WIDE = "(min-width: 64rem)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(WIDE);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/** False on the server and until the browser answers: the phone layout is
 *  the safe first paint, and the map's place is kept at `lg` meanwhile. */
function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(WIDE).matches ?? false,
    () => false,
  );
}

const cardId = (id: string) => `sesh-card-${id}`;

/**
 * The feed's list and map (#125). On a phone it is today's feed: the list or
 * the map, as the List / Map switch says, and the map gains no tap actions.
 * From `lg` up both show at once — the list left, the map right — and one
 * "lit" sesh ties them: pointing at or tabbing to a card lights its Fuzzy
 * circle, and clicking a circle lights its card and scrolls it into view. A
 * circle click never opens the sesh; the card does that.
 *
 * Both show the seshes the server sent for this page, so paging moves the map
 * with the list.
 */
export function FeedBoard({ seshes, view, viewerId, now, header, footer, empty }: Props) {
  const wide = useWide();
  const [lit, setLit] = useState<string | null>(null);

  // Memoised: the map pushes new circles on every change of this array.
  const circles = useMemo(
    () =>
      seshes
        .filter((sesh) => sesh.fuzzyLat !== null && sesh.fuzzyLng !== null)
        .map((sesh) => ({ id: sesh.id, lat: sesh.fuzzyLat!, lng: sesh.fuzzyLng!, radiusM: sesh.fuzzyRadiusM })),
    [seshes],
  );

  const showCard = useCallback((id: string) => {
    setLit(id);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(cardId(id))?.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, []);

  if (empty) return <FeedPage main={<>{header}{empty}</>} />;

  const list = (
    <ul className="flex flex-col gap-3">
      {seshes.map((sesh) => {
        const here = wide && lit === sesh.id;
        // Laptop only: on a phone there is no map beside the list to light.
        const on = wide ? () => setLit(sesh.id) : undefined;
        const off = wide ? () => setLit((current) => (current === sesh.id ? null : current)) : undefined;
        return (
          <li
            key={sesh.id}
            id={cardId(sesh.id)}
            data-lit={here || undefined}
            onMouseEnter={on}
            onMouseLeave={off}
            onFocus={on}
            onBlur={off}
            className="scroll-mt-20"
          >
            <SeshCard sesh={sesh} viewerId={viewerId} now={now} lit={here} />
          </li>
        );
      })}
    </ul>
  );

  if (wide) {
    return (
      <FeedPage
        main={<>{header}{list}{footer}</>}
        side={<FeedMap circles={circles} lit={lit} onCircleClick={showCard} tall />}
      />
    );
  }

  return (
    <FeedPage
      main={
        <>
          {header}
          {view === "map" ? <FeedMap circles={circles} /> : list}
          {footer}
        </>
      }
      side={null}
    />
  );
}
