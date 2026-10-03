import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedBoard } from "@/components/sesh/feed-board";
import type { FeedSesh } from "@/lib/sesh/queries";

/** The feed list and the feed map on a laptop (#125). MapLibre and the
 *  screen width are the browser parts, so those are what get faked — never
 *  our own components. The fake keeps every handler the map registers and
 *  every filter it is given, so a test can click a circle and read back which
 *  circle is lit. */
type Handler = (event: unknown) => void;
const handlers: { event: string; layer: string | null; handler: Handler }[] = [];
const filters: { layer: string; filter: unknown }[] = [];

vi.mock("maplibre-gl", () => {
  class FakeMap {
    on(event: string, layerOrHandler: string | Handler, maybe?: Handler) {
      const layer = typeof layerOrHandler === "string" ? layerOrHandler : null;
      const handler = (typeof layerOrHandler === "string" ? maybe : layerOrHandler)!;
      handlers.push({ event, layer, handler });
      if (event === "load") handler({});
      return this;
    }
    addSource() {}
    addLayer() {}
    getSource() {
      return { setData: vi.fn() };
    }
    setFilter(layer: string, filter: unknown) {
      filters.push({ layer, filter });
    }
    getCanvas() {
      return { style: {} };
    }
    getBounds() {
      return { contains: () => true };
    }
    easeTo() {}
    setCenter() {}
    remove() {}
  }
  class FakeMarker {}
  return { Map: FakeMap, Marker: FakeMarker, setWorkerUrl: vi.fn() };
});

function screenIs(wide: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: wide,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function clickCircle(id: string) {
  const click = handlers.find((h) => h.event === "click" && h.layer === "circle-fill");
  act(() => click?.handler({ features: [{ properties: { id } }] }));
}

/** The last filter the lit layers were given names the lit circle. */
function litCircle(): string | null {
  const last = filters.at(-1)?.filter;
  return JSON.stringify(last ?? null).match(/"s\d"/)?.[0].replaceAll('"', "") ?? null;
}

function sesh(id: string, title: string): FeedSesh {
  return {
    id,
    hostId: "host-1",
    title,
    description: null,
    seshType: "chill",
    startsAt: "2026-10-09T23:30:00.000Z",
    capacity: 6,
    status: "open",
    visibility: "listed",
    areaName: null,
    approvedCount: 0,
    materiallyChangedAt: null,
    fuzzyLat: 27.99,
    fuzzyLng: -82.46,
    fuzzyRadiusM: 400,
    host: { handle: "porchlight", displayName: null, avatarSeed: null },
  };
}

const SESHES = [sesh("s1", "Porch hang"), sesh("s2", "Beach walk")];

function renderBoard(view: "list" | "map" = "list") {
  return render(
    <FeedBoard seshes={SESHES} view={view} viewerId="me" now="2026-10-03T14:00:00.000Z" header={null} footer={null} />,
  );
}

const card = (title: string) => screen.getByRole("link", { name: new RegExp(title) }).closest("li")!;

beforeEach(() => {
  handlers.length = 0;
  filters.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FeedBoard on a laptop", () => {
  beforeEach(() => screenIs(true));

  it("shows the list and the map together", async () => {
    renderBoard();
    expect(screen.getByRole("link", { name: /Porch hang/ })).toBeInTheDocument();
    expect(await screen.findByRole("application", { name: /Seshes near you/ })).toBeInTheDocument();
  });

  it("lights a card's circle when a member points at the card", async () => {
    renderBoard();
    await waitFor(() => expect(handlers.some((h) => h.layer === "circle-fill")).toBe(true));

    fireEvent.mouseEnter(card("Beach walk"));
    expect(litCircle()).toBe("s2");
  });

  it("lights a card's circle when a member tabs to the card", async () => {
    renderBoard();
    await waitFor(() => expect(handlers.some((h) => h.layer === "circle-fill")).toBe(true));

    fireEvent.focus(screen.getByRole("link", { name: /Porch hang/ }));
    expect(litCircle()).toBe("s1");
  });

  it("lights the card when its circle is clicked, without opening the sesh", async () => {
    renderBoard();
    await waitFor(() => expect(handlers.some((h) => h.layer === "circle-fill")).toBe(true));

    clickCircle("s2");
    expect(card("Beach walk")).toHaveAttribute("data-lit", "true");
    expect(card("Porch hang")).not.toHaveAttribute("data-lit");
  });
});

describe("FeedBoard on a phone", () => {
  beforeEach(() => screenIs(false));

  it("shows only the list in list view", () => {
    renderBoard("list");
    expect(screen.getByRole("link", { name: /Porch hang/ })).toBeInTheDocument();
    expect(screen.queryByRole("application")).not.toBeInTheDocument();
  });

  it("shows only the map in map view, and a circle tap does nothing new", async () => {
    renderBoard("map");
    expect(await screen.findByRole("application", { name: /Seshes near you/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Porch hang/ })).not.toBeInTheDocument();

    clickCircle("s2");
    expect(litCircle()).toBeNull();
  });
});
