import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/login/login-form", () => ({ LoginForm: () => null }));
vi.mock("@/app/demo-actions", () => ({ enterDemo: vi.fn() }));

import LoginPage from "@/app/login/page";

/** Issue #68. A stranger who opens a shared link lands here, so the page says
 *  in one line what the app is and who it is for, above the form. */
describe("the login page", () => {
  it("says in one line what Meet4Weed is and who it is for", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    const line = screen.getByText(/medical cannabis patients/i);
    expect(line).toHaveTextContent(/Florida/);
    expect(line).toHaveTextContent(/medical cannabis/i);
    expect(line).toHaveTextContent(/21/);
  });

  // Issue #97. A stranger who lands here can reach what the app is.
  it("links back to the landing page", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /what is meet4weed/i })).toHaveAttribute("href", "/");
  });

  // Issue #39. The demo door, as a form button, only when the flag is on.
  describe("the demo door", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("offers the demo as a button, never a link, when the flag is on", async () => {
      vi.stubEnv("DEMO_MODE_ENABLED", "true");
      render(await LoginPage({ searchParams: Promise.resolve({}) }));

      expect(screen.getByRole("button", { name: /just looking\? try the demo/i })).toHaveAttribute("type", "submit");
      expect(screen.queryByRole("link", { name: /demo/i })).toBeNull();
    });

    it("offers nothing when the flag is off", async () => {
      vi.stubEnv("DEMO_MODE_ENABLED", "");
      render(await LoginPage({ searchParams: Promise.resolve({}) }));

      expect(screen.queryByRole("button", { name: /demo/i })).toBeNull();
    });
  });
});
