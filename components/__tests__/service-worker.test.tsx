import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceWorker } from "@/components/service-worker";

const register = vi.fn(() => Promise.resolve({}));

afterEach(() => {
  register.mockClear();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("ServiceWorker", () => {
  it("registers the worker for the whole app once the page has loaded", () => {
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    render(<ServiceWorker />);
    // jsdom has finished loading by now, so this is the "already loaded" path.
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
  });

  it("does nothing in a browser without service workers", () => {
    expect(() => render(<ServiceWorker />)).not.toThrow();
    expect(register).not.toHaveBeenCalled();
  });

  it("swallows a failed registration: the app works without a worker", async () => {
    const failing = vi.fn(() => Promise.reject(new Error("blocked")));
    Object.defineProperty(navigator, "serviceWorker", { value: { register: failing }, configurable: true });
    render(<ServiceWorker />);
    await Promise.resolve();
    expect(failing).toHaveBeenCalled();
  });
});
