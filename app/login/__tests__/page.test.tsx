import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/login/login-form", () => ({ LoginForm: () => null }));

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
});
