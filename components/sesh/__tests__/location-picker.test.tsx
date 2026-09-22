import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocationPicker } from "@/components/sesh/location-picker";

/** MapLibre is the external dependency, so MapLibre is what gets stubbed —
 *  not our own components. The stub keeps the handlers the component
 *  registers, so a test can make the map behave as though somebody tapped it. */
const handlers = new Map<string, (event: unknown) => void>();
const removed = vi.fn();
const setWorkerUrl = vi.fn();

vi.mock("maplibre-gl", () => {
  class FakeMap {
    on(event: string, handler: (event: unknown) => void) {
      handlers.set(event, handler);
      if (event === "load") handler({});
      return this;
    }
    addSource() {
      return this;
    }
    addLayer() {
      return this;
    }
    getSource() {
      return { setData: vi.fn() };
    }
    getLayer() {
      return undefined;
    }
    setCenter() {
      return this;
    }
    remove() {
      removed();
    }
  }
  class FakeMarker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      return this;
    }
  }
  // maplibre-gl v6 exports by name, with no default export.
  return { Map: FakeMap, Marker: FakeMarker, setWorkerUrl };
});

function tapTheMapAt(lat: number, lng: number) {
  handlers.get("click")?.({ lngLat: { lat, lng } });
}

function formData(): FormData {
  return new FormData(screen.getByRole("form", { name: "where" }) as HTMLFormElement);
}

function renderPicker(props: Partial<Parameters<typeof LocationPicker>[0]> = {}) {
  return render(
    <form aria-label="where">
      <LocationPicker {...props} />
    </form>,
  );
}

describe("LocationPicker", () => {
  beforeEach(() => {
    handlers.clear();
    removed.mockReset();
    setWorkerUrl.mockReset();
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition: vi.fn(), watchPosition: vi.fn() } });
  });

  // Left to itself MapLibre derives this address from `import.meta.url`, the
  // production build emits nothing there, and the browser gets the app shell
  // back. The failure is silent: the map draws its background, keeps its
  // controls, and never loads a tile. So it is asserted rather than trusted.
  it("points MapLibre at the worker copied into public/", async () => {
    renderPicker();
    await waitFor(() => expect(setWorkerUrl).toHaveBeenCalledWith("/maplibre/maplibre-gl-worker.js"));
  });

  it("tells the host, before they type anything, that nobody sees this until they approve them", () => {
    renderPicker();

    expect(screen.getByText(/until you approve/i)).toBeInTheDocument();
  });

  /** An app built around not leaking location does not open by asking for
   *  the host's. */
  it("never asks the browser where the host is", async () => {
    renderPicker();

    await waitFor(() => expect(handlers.has("click")).toBe(true));

    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
  });

  it("submits nothing for the pin until one is placed", async () => {
    renderPicker();

    await waitFor(() => expect(handlers.has("click")).toBe(true));

    expect(formData().get("exactLat")).toBe("");
    expect(formData().get("exactLng")).toBe("");
  });

  it("submits the point the host tapped", async () => {
    renderPicker();
    await waitFor(() => expect(handlers.has("click")).toBe(true));

    tapTheMapAt(27.9506, -82.4572);

    await waitFor(() => expect(formData().get("exactLat")).toBe("27.9506"));
    expect(formData().get("exactLng")).toBe("-82.4572");
  });

  it("shows the host what the public will see once a pin exists", async () => {
    renderPicker();
    await waitFor(() => expect(handlers.has("click")).toBe(true));

    tapTheMapAt(27.9506, -82.4572);

    expect(await screen.findByText(/circle/i)).toBeInTheDocument();
  });

  it("starts from the pin an existing sesh already has", async () => {
    renderPicker({ defaultPoint: { lat: 28.1, lng: -82.5 } });

    await waitFor(() => expect(formData().get("exactLat")).toBe("28.1"));
    expect(screen.getByText(/circle/i)).toBeInTheDocument();
  });

  it("tidies the map up when the screen goes away", async () => {
    const { unmount } = renderPicker();
    await waitFor(() => expect(handlers.has("click")).toBe(true));

    unmount();

    await waitFor(() => expect(removed).toHaveBeenCalled());
  });
});
