import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Select } from "@/components/ui/select";

const TYPES = [
  { value: "chill", label: "Chill" },
  { value: "smoke_circle", label: "Smoke circle" },
] as const;

describe("Select", () => {
  it("takes focus when its label is clicked", async () => {
    render(<Select label="Type" name="seshType" options={TYPES} />);

    await userEvent.click(screen.getByText("Type"));

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveFocus();
  });

  it("shows a readable label for each option while submitting the stored value", async () => {
    render(
      <form aria-label="sesh">
        <Select label="Type" name="seshType" options={TYPES} />
      </form>,
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Type" }), "smoke_circle");

    expect(screen.getByRole("option", { name: "Smoke circle" })).toBeInTheDocument();
    const data = new FormData(screen.getByRole("form", { name: "sesh" }) as HTMLFormElement);
    expect(data.get("seshType")).toBe("smoke_circle");
  });
});
