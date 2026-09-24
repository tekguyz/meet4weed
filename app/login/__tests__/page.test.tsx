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
});
