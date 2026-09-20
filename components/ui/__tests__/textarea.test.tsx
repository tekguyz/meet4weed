import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  it("takes focus when its label is clicked", async () => {
    render(<Textarea label="Description" name="description" />);

    await userEvent.click(screen.getByText("Description"));

    expect(screen.getByRole("textbox", { name: "Description" })).toHaveFocus();
  });

  it("carries what was typed into the submitted form data", async () => {
    render(
      <form aria-label="sesh">
        <Textarea label="Description" name="description" />
      </form>,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Description" }), "Bring a blanket");

    const data = new FormData(screen.getByRole("form", { name: "sesh" }) as HTMLFormElement);
    expect(data.get("description")).toBe("Bring a blanket");
  });
});
