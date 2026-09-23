import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionResult, Banner } from "@/components/ui/banner";

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

  /** DESIGN.md "Cards / Containers": Ember Raised and 12px when nested, so a
   *  banner inside a card still reads as its own thing. */
  it("steps up to the raised surface inside a card", () => {
    render(<Banner nested>Message</Banner>);
    const banner = screen.getByRole("status");

    expect(banner).toHaveClass("bg-surface-2", "p-3");
    expect(banner).not.toHaveClass("bg-surface", "p-4");
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

/** The answer from a server action: one mapping from ok to tone, shared by
 *  every form that shows one, so the forms cannot drift apart. */
describe("ActionResult", () => {
  it("shows a success as success", () => {
    render(<ActionResult state={{ ok: true, message: "Added." }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Added.");
    expect(screen.getByRole("status")).toHaveClass("text-primary");
  });

  it("shows a failure as danger", () => {
    render(<ActionResult state={{ ok: false, message: "That did not work." }} />);

    expect(screen.getByRole("status")).toHaveClass("text-danger");
  });

  it("shows nothing before the action has run", () => {
    render(<ActionResult state={null} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
