import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const changeHandle = vi.fn();
vi.mock("@/app/(frame)/me/settings/actions", () => ({
  changeHandle: (...a: unknown[]) => changeHandle(...a),
}));

import { ChangeHandleForm } from "@/components/member/change-handle-form";

beforeEach(() => {
  changeHandle.mockReset().mockResolvedValue({ ok: true, message: "Handle changed to @ryder_2." });
});

describe("ChangeHandleForm (issue #70)", () => {
  it("starts from the current handle and says the 30-day rules up front", () => {
    render(<ChangeHandleForm handle="ryder" />);

    expect(screen.getByLabelText("Handle")).toHaveValue("ryder");
    expect(screen.getByText(/once every 30 days/i)).toBeInTheDocument();
  });

  it("sends the new handle and shows the saved message", async () => {
    render(<ChangeHandleForm handle="ryder" />);

    const field = screen.getByLabelText("Handle");
    await userEvent.clear(field);
    await userEvent.type(field, "ryder_2");
    await userEvent.click(screen.getByRole("button", { name: "Change handle" }));

    const form = changeHandle.mock.calls[0][1] as FormData;
    expect(form.get("handle")).toBe("ryder_2");
    expect(await screen.findByText("Handle changed to @ryder_2.")).toBeInTheDocument();
  });

  it("shows a refusal under the field as an alert", async () => {
    changeHandle.mockResolvedValue({
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { handle: "That handle is taken. Try another." },
    });
    render(<ChangeHandleForm handle="ryder" />);

    await userEvent.click(screen.getByRole("button", { name: "Change handle" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That handle is taken. Try another.");
  });

  // React resets an uncontrolled form after its action runs. A refused handle
  // must stay in the box, so the member can fix it rather than retype it.
  it("keeps what the member typed after a refusal", async () => {
    changeHandle.mockResolvedValue({
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: { handle: "That handle is taken. Try another." },
    });
    render(<ChangeHandleForm handle="ryder" />);

    const field = screen.getByLabelText("Handle");
    await userEvent.clear(field);
    await userEvent.type(field, "jweed");
    await userEvent.click(screen.getByRole("button", { name: "Change handle" }));
    await screen.findByRole("alert");

    expect(screen.getByLabelText("Handle")).toHaveValue("jweed");
  });
});
