import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Banner } from "@/components/ui/banner";

describe("Banner", () => {
  it("announces politely, so a screen reader does not lose its place", () => {
    render(<Banner>Saved.</Banner>);
    const banner = screen.getByRole("status");

    expect(banner).toHaveTextContent("Saved.");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  /** DESIGN.md "Notice cards": the text colour carries the tone. Token
   *  classes only — an inline colour would break one of the two themes. */
  it.each([
    ["info", "text-ink"],
    ["success", "text-primary"],
    ["warning", "text-secondary"],
    ["danger", "text-danger"],
  ] as const)("shows the %s tone with the %s token", (tone, token) => {
    render(<Banner tone={tone}>Message</Banner>);
    const banner = screen.getByRole("status");

    expect(banner).toHaveClass(token);
    expect(banner).not.toHaveAttribute("style");
  });

  it("is information when no tone is given", () => {
    render(<Banner>Message</Banner>);

    expect(screen.getByRole("status")).toHaveClass("text-ink");
  });

  it("can hold more than one line", () => {
    render(
      <Banner>
        <h2>Held</h2>
        <p>Sign in to redeem it.</p>
      </Banner>,
    );

    expect(screen.getByRole("status")).toContainElement(screen.getByRole("heading", { name: "Held" }));
  });
});
