import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Vitest has no image loader; a real import gives Next's <Image> no width.
vi.mock("@/showcase/seshes-desktop-dark.png", () => ({ default: { src: "/dark.png", width: 1440, height: 900 } }));
vi.mock("@/showcase/seshes-desktop-light.png", () => ({ default: { src: "/light.png", width: 1440, height: 900 } }));
vi.mock("@/app/login/login-form", () => ({ LoginForm: () => null }));

import LoginPage from "@/app/login/page";
import { CHECKS } from "@/components/landing/copy";

/** Issue #68. A stranger who opens a shared link lands here, so the page says
 *  in one line what the app is and who it is for, above the form. */
describe("the login page", () => {
  it("says in one line what Meet4Weed is and who it is for", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    const [line] = screen.getAllByText(/medical cannabis patients/i);
    expect(line).toHaveTextContent(/Florida/);
    expect(line).toHaveTextContent(/medical cannabis/i);
    expect(line).toHaveTextContent(/21/);
  });

  // Issue #97. A stranger who lands here can reach what the app is.
  it("links back to the landing page", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /what is meet4weed/i })).toHaveAttribute("href", "/");
  });

  // Issue #126. The brand panel: plain link to the landing page, never a demo button.
  describe("the brand panel", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("links to the landing page with the plain words", async () => {
      render(await LoginPage({ searchParams: Promise.resolve({}) }));

      expect(screen.getByRole("link", { name: /just looking\? see what it does/i })).toHaveAttribute("href", "/");
    });

    it("has no demo button, with the flag on or off", async () => {
      for (const flag of ["true", ""]) {
        vi.stubEnv("DEMO_MODE_ENABLED", flag);
        const { unmount } = render(await LoginPage({ searchParams: Promise.resolve({}) }));
        expect(screen.queryByRole("button", { name: /demo/i })).toBeNull();
        unmount();
      }
    });

    it("reuses the landing page's own lines and shows a real capture", async () => {
      render(await LoginPage({ searchParams: Promise.resolve({}) }));

      expect(screen.getByText(CHECKS[1].title)).toBeInTheDocument();
      expect(screen.getByText(CHECKS[2].title)).toBeInTheDocument();
      expect(screen.getAllByAltText(/seshes list/i).length).toBeGreaterThan(0);
    });
  });
});
