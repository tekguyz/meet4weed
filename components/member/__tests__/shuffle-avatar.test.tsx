import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const shuffleAvatar = vi.fn();
vi.mock("@/app/(frame)/me/settings/actions", () => ({
  shuffleAvatar: (...a: unknown[]) => shuffleAvatar(...a),
}));

import { ShuffleAvatar } from "@/components/member/shuffle-avatar";

const ME = { memberId: "m-1", handle: "ryder", displayName: null };

beforeEach(() => {
  shuffleAvatar.mockReset().mockResolvedValue({ ok: true, message: "New avatar saved." });
});

describe("ShuffleAvatar (issue #69)", () => {
  it("shows the current avatar above a Shuffle button", () => {
    const { container } = render(<ShuffleAvatar {...ME} seed="abc" />);

    expect(container.querySelector("[data-avatar]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Shuffle" })).toBeInTheDocument();
  });

  it("sends the seed on screen, so the new one can look different", async () => {
    render(<ShuffleAvatar {...ME} seed="abc" />);

    await userEvent.click(screen.getByRole("button", { name: "Shuffle" }));

    const form = shuffleAvatar.mock.calls[0][1] as FormData;
    expect(form.get("currentSeed")).toBe("abc");
    expect(await screen.findByText("New avatar saved.")).toBeInTheDocument();
  });

  it("sends no seed when the avatar is drawn from the member id", async () => {
    render(<ShuffleAvatar {...ME} seed={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Shuffle" }));

    const form = shuffleAvatar.mock.calls[0][1] as FormData;
    expect(form.get("currentSeed")).toBeNull();
  });
});
