import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const device = vi.hoisted(() => ({
  pushSupport: vi.fn(() => "supported" as const),
  readPushState: vi.fn(async () => "off" as const),
  turnPushOn: vi.fn(async () => "on" as const),
}));
vi.mock("@/lib/notify/device-push", () => device);

import { PushOffer } from "@/components/notify/push-offer";

function permission(value: NotificationPermission) {
  vi.stubGlobal("Notification", { permission: value });
}

describe("the explain-first push card", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    device.pushSupport.mockReturnValue("supported");
    device.readPushState.mockResolvedValue("off");
  });

  it("explains first, and asks the browser only when Turn on is pressed", async () => {
    permission("default");
    render(<PushOffer />);

    expect(await screen.findByRole("heading", { name: /nudge/i })).toBeInTheDocument();
    expect(screen.getByText(/never who, never which/i)).toBeInTheDocument();
    expect(device.turnPushOn).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Turn on" }));

    expect(device.turnPushOn).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("heading", { name: /nudge/i })).not.toBeInTheDocument());
  });

  it("stays hidden once the browser has been asked, either way", async () => {
    for (const value of ["granted", "denied"] as const) {
      permission(value);
      const { container, unmount } = render(<PushOffer />);
      await Promise.resolve();
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("remembers Not now on this device", async () => {
    permission("default");
    const { unmount } = render(<PushOffer />);
    await userEvent.click(await screen.findByRole("button", { name: "Not now" }));
    unmount();

    const { container } = render(<PushOffer />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
    expect(device.turnPushOn).not.toHaveBeenCalled();
  });

  it("tells an iPhone in a browser tab to add the app to the Home Screen first", async () => {
    device.pushSupport.mockReturnValue("ios-install" as never);
    render(<PushOffer />);

    expect(await screen.findByText(/add Meet4Weed to your Home Screen/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on" })).not.toBeInTheDocument();
  });
});
