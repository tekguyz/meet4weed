import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttestationForm } from "@/components/onboarding/attestation-form";

vi.mock("@/app/onboarding/actions", () => ({
  recordAttestation: vi.fn(),
}));

describe("AttestationForm", () => {
  it("shows all four claims as separate boxes", () => {
    render(<AttestationForm />);

    expect(screen.getByLabelText(/21 or older/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^I live in Florida/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/valid, unexpired Florida OMMU/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/never.*buy or sell/i)).toBeInTheDocument();
  });

  it("requires every box before the browser will submit", () => {
    render(<AttestationForm />);

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(4);
    for (const box of boxes) {
      expect(box).toBeRequired();
    }
  });

  it("starts with every box unticked, so nothing is agreed to by default", () => {
    render(<AttestationForm />);

    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).not.toBeChecked();
    }
  });

  // Issue #68. The member reads what they agree to at the moment they agree.
  it("links the terms, the privacy page and the community rules", () => {
    render(<AttestationForm />);

    expect(screen.getByRole("link", { name: /^Terms/ })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /^Privacy/ })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /^Community rules/ })).toHaveAttribute("href", "/rules");
  });
});
