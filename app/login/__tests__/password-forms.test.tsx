import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setNewPassword = vi.fn();
const signUpWithPassword = vi.fn();

vi.mock("@/app/auth/actions/recovery", () => ({ setNewPassword: (...a: unknown[]) => setNewPassword(...a) }));
vi.mock("@/app/auth/actions/sign-up", () => ({ signUpWithPassword: (...a: unknown[]) => signUpWithPassword(...a) }));

import { NewPasswordForm } from "@/app/login/new-password/new-password-form";
import { SignUpForm } from "@/app/login/sign-up-form";
import { PASSWORDS_DIFFER } from "@/app/login/failure-text";

beforeEach(() => {
  setNewPassword.mockReset();
  signUpWithPassword.mockReset().mockResolvedValue({ ok: true });
});

describe("new password", () => {
  it("refuses two passwords that differ, without calling the server", async () => {
    render(<NewPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "Abcdef1!");
    await userEvent.type(screen.getByLabelText("Type the new password again"), "Abcdef1?");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));

    expect(screen.getByRole("alert")).toHaveTextContent(PASSWORDS_DIFFER);
    expect(setNewPassword).not.toHaveBeenCalled();
  });

  it("sends the password once both match", async () => {
    render(<NewPasswordForm />);
    await userEvent.type(screen.getByLabelText("New password"), "Abcdef1!");
    await userEvent.type(screen.getByLabelText("Type the new password again"), "Abcdef1!");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));

    expect(setNewPassword).toHaveBeenCalledWith({ password: "Abcdef1!" });
  });
});

describe("sign-up", () => {
  it("refuses two passwords that differ, without calling the server", async () => {
    render(<SignUpForm onBack={() => {}} />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "Abcdef1!");
    await userEvent.type(screen.getByLabelText("Type the password again"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent(PASSWORDS_DIFFER);
    expect(signUpWithPassword).not.toHaveBeenCalled();
  });
});

describe("show password button", () => {
  it("reveals and hides the typed password", async () => {
    render(<NewPasswordForm />);
    const field = screen.getByLabelText("New password");
    expect(field).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show new password" }));
    expect(field).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Hide new password" }));
    expect(field).toHaveAttribute("type", "password");
  });
});
