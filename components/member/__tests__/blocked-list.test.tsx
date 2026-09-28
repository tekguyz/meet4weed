import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { unblockMember } = vi.hoisted(() => ({ unblockMember: vi.fn() }));
vi.mock("@/app/(frame)/m/block-actions", () => ({ unblockMember }));

import { BlockedList } from "@/components/member/blocked-list";

const BOB = {
  memberId: "22222222-2222-4222-8222-222222222222",
  handle: "bob",
  displayName: "Bob",
  avatarSeed: null,
  blockedAt: "2026-09-28T15:00:00Z",
};
const DAVE = {
  memberId: "44444444-4444-4444-8444-444444444444",
  handle: "dave",
  displayName: null,
  avatarSeed: null,
  blockedAt: "2026-09-20T15:00:00Z",
};

beforeEach(() => {
  unblockMember.mockReset().mockResolvedValue({ ok: true, message: "Unblocked." });
});

describe("BlockedList (issue #112)", () => {
  it("shows each blocked member in the order it is given, newest first", () => {
    render(<BlockedList blocks={[BOB, DAVE]} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("@bob");
    expect(rows[1]).toHaveTextContent("@dave");
  });

  it("does not link to a profile the wall hides", () => {
    render(<BlockedList blocks={[BOB]} />);
    expect(screen.queryByRole("link", { name: /bob/ })).toBeNull();
  });

  it("asks before it unblocks, and says what an unblock does", () => {
    render(<BlockedList blocks={[BOB]} />);
    fireEvent.click(screen.getByRole("button", { name: "Unblock @bob" }));

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent(/see each other’s profiles and seshes again/i);
    expect(within(row).getByRole("button", { name: "Unblock" })).toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Unblock @bob" })).toBeInTheDocument();
    expect(unblockMember).not.toHaveBeenCalled();
  });

  it("sends the member it names when Unblock is confirmed", async () => {
    render(<BlockedList blocks={[BOB, DAVE]} />);
    fireEvent.click(screen.getByRole("button", { name: "Unblock @dave" }));
    fireEvent.click(screen.getByRole("button", { name: "Unblock" }));

    await waitFor(() => expect(unblockMember).toHaveBeenCalledTimes(1));
    const fd = unblockMember.mock.calls[0][1] as FormData;
    expect(fd.get("memberId")).toBe(DAVE.memberId);
  });

  it("shows a calm empty state when nobody is blocked", () => {
    render(<BlockedList blocks={[]} />);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText(/haven’t blocked anyone/i)).toBeInTheDocument();
  });
});
