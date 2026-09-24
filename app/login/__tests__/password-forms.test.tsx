import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setNewPassword = vi.fn();
const changePassword = vi.fn();
const signUpWithPassword = vi.fn();

vi.mock("@/app/auth/actions/recovery", () => ({
  setNewPassword: (...a: unknown[]) => setNewPassword(...a),
  changePassword: (...a: unknown[]) => changePassword(...a),
}));
vi.mock("@/app/auth/actions/sign-up", () => ({ signUpWithPassword: (...a: unknown[]) => signUpWithPassword(...a) }));

import { NewPasswordForm } from "@/app/login/new-password/new-password-form";
import { SignUpForm } from "@/app/login/sign-up-form";
import { PASSWORDS_DIFFER } from "@/app/login/failure-text";

beforeEach(() => {
  setNewPassword.mockReset();
  changePassword.mockReset().mockResolvedValue({ ok: true });
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

describe("changing the password while signed in (issue #65)", () => {
  async function submit(password: string) {
    await userEvent.type(screen.getByLabelText("New password"), password);
    await userEvent.type(screen.getByLabelText("Type the new password again"), password);
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
  }

  it("uses the signed-in action, not the reset one, and shows the banner", async () => {
    render(<NewPasswordForm mode="change" />);
    await submit("Abcdef1!");

    expect(changePassword).toHaveBeenCalledWith({ password: "Abcdef1!" });
    expect(setNewPassword).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("Password changed.");
  });

  it("clears both fields after a change, so the page does not hold the password", async () => {
    render(<NewPasswordForm mode="change" />);
    await submit("Abcdef1!");

    await screen.findByRole("status");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Type the new password again")).toHaveValue("");
  });

  it("says why a change was refused, in the banner", async () => {
    changePassword.mockResolvedValue({ ok: false, failure: "same_password" });
    render(<NewPasswordForm mode="change" />);
    await submit("Abcdef1!");

    expect(await screen.findByRole("status")).toHaveTextContent(/have not used/i);
  });

  it("does not talk about a reset link when the session has gone", async () => {
    changePassword.mockResolvedValue({ ok: false, failure: "no_session" });
    render(<NewPasswordForm mode="change" />);
    await submit("Abcdef1!");

    expect(await screen.findByRole("status")).toHaveTextContent(/sign in again/i);
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

  // Issue #68.
  it("links the terms, the privacy page and the community rules", () => {
    render(<SignUpForm onBack={() => {}} />);

    expect(screen.getByRole("link", { name: /^Terms/ })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /^Privacy/ })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /^Community rules/ })).toHaveAttribute("href", "/rules");
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
