import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionResult, Banner, FieldError } from "@/components/ui/banner";

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

  /** Issue #75: an error must reach a screen reader at once, not after it
   *  finishes the sentence it is reading. */
  it("interrupts when urgent, so an error is heard at once", () => {
    render(<Banner tone="danger" urgent>That password is wrong.</Banner>);
    const banner = screen.getByRole("alert");

    expect(banner).toHaveTextContent("That password is wrong.");
    expect(banner).toHaveClass("text-danger", "bg-surface");
    expect(banner).not.toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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

/** A per-field error stays under its field, small, so the member sees which
 *  box it is about. Not a card: a card under every box would bury the form. */
describe("FieldError", () => {
  it("interrupts with the message under its field", () => {
    render(<FieldError message="Eight tags maximum." />);
    const line = screen.getByRole("alert");

    expect(line).toHaveTextContent("Eight tags maximum.");
    expect(line).toHaveClass("text-xs", "text-danger");
    expect(line).not.toHaveAttribute("style");
  });

  it("shows nothing when the field is fine", () => {
    render(<FieldError message={undefined} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
