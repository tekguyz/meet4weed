import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangedBanner } from "@/components/sesh/changed-banner";

const IN_TWO_DAYS = new Date(Date.now() + 2 * 86_400_000).toISOString();
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();
const CHANGED = new Date(Date.now() - 3_600_000).toISOString();

describe("ChangedBanner", () => {
  it("warns when the host has moved the sesh", () => {
    render(<ChangedBanner changedAt={CHANGED} startsAt={IN_TWO_DAYS} />);

    expect(screen.getByRole("status")).toHaveTextContent(/changed/i);
  });

  it("says nothing when the host has not moved it", () => {
    render(<ChangedBanner changedAt={null} startsAt={IN_TWO_DAYS} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stops once the sesh has started", () => {
    render(<ChangedBanner changedAt={CHANGED} startsAt={YESTERDAY} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  /** A guest who is not approved cannot read the address, so the banner must
   *  not smuggle the new one out in its wording. No date, no time, no
   *  coordinates — nothing with a digit in it. */
  it("gives nothing away about where or when it moved to", () => {
    render(<ChangedBanner changedAt={CHANGED} startsAt={IN_TWO_DAYS} />);

    expect(screen.getByRole("status").textContent).not.toMatch(/\d/);
  });
});
