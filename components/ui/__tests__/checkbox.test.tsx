import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  it("is operated by clicking its label text, not only the box", async () => {
    render(<Checkbox label="I am 21 or older" name="age" />);
    const box = screen.getByRole("checkbox", { name: "I am 21 or older" });

    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText("I am 21 or older"));

    expect(box).toBeChecked();
  });

  it("carries its name into the submitted form data", async () => {
    render(
      <form aria-label="attest">
        <Checkbox label="No sales" name="noSales" />
      </form>,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "No sales" }));

    const data = new FormData(screen.getByRole("form", { name: "attest" }) as HTMLFormElement);
    expect(data.get("noSales")).toBe("on");
  });
});
