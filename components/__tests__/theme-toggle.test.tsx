import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";
import { EXPECTED_BG, loadThemeTokens, themeColor } from "@/lib/__tests__/load-theme-tokens";

describe("ThemeToggle", () => {
  let unloadTokens: () => void;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light");
    unloadTokens = loadThemeTokens();
  });

  afterEach(() => {
    unloadTokens();
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });

  it("switches to light and records the choice", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /light/i }));

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("switches back to dark and removes the light class", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /light/i }));
    await userEvent.click(screen.getByRole("button", { name: /dark/i }));

    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("repaints the browser bars at once, in both themes", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /light/i }));
    expect(themeColor()).toBe(EXPECTED_BG.light);

    await userEvent.click(screen.getByRole("button", { name: /dark/i }));
    expect(themeColor()).toBe(EXPECTED_BG.dark);
  });

  it("marks the active choice for assistive tech", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /light/i }));

    expect(screen.getByRole("button", { name: /light/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /dark/i })).toHaveAttribute("aria-pressed", "false");
  });
});
