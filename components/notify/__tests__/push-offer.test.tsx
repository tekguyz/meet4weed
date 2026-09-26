import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const device = vi.hoisted(() => ({
  PUSH_WORDS: {
    iosInstall: "On iPhone, notifications work only in the Home Screen app.",
    blocked: "Notifications are blocked for Meet4Weed on this phone.",
    failed: "Could not turn on notifications. Check your connection and try again.",
    turningOn: "Turning on…",
  },
  pushSupport: vi.fn((): string => "supported"),
  turnPushOn: vi.fn(async (): Promise<string> => "on"),
}));
vi.mock("@/lib/notify/device-push", () => device);

import { PushOffer } from "@/components/notify/push-offer";

function permission(value: NotificationPermission) {
  vi.stubGlobal("Notification", { permission: value });
}

const heading = { name: /notifications for your seshes/i };

describe("the explain-first push card", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    device.pushSupport.mockReturnValue("supported");
    device.turnPushOn.mockResolvedValue("on");
    permission("default");
  });

  it("explains first, and asks the browser only when Turn on is pressed", async () => {
    render(<PushOffer />);

    expect(await screen.findByRole("heading", heading)).toBeInTheDocument();
    expect(screen.getByText(/never who, never which/i)).toBeInTheDocument();
    expect(device.turnPushOn).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Turn on" }));

    expect(device.turnPushOn).toHaveBeenCalledOnce();
  });

  it("proves it worked, in place of the card, with the way back to Settings", async () => {
    render(<PushOffer />);
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }));

    expect(await screen.findByText(/notifications are on for this device/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/me/settings/notifications");
    expect(screen.queryByRole("heading", heading)).not.toBeInTheDocument();
  });

  it("says so when turning on failed, and keeps the button to try again", async () => {
    device.turnPushOn.mockResolvedValue("failed");
    render(<PushOffer />);
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not turn on notifications/i);
    expect(screen.getByRole("button", { name: "Turn on" })).toBeEnabled();
  });

  it("gives the steps to unblock when the member said no to the browser", async () => {
    device.turnPushOn.mockResolvedValue("blocked");
    render(<PushOffer />);
    await userEvent.click(await screen.findByRole("button", { name: "Turn on" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/blocked for Meet4Weed/i);
    expect(screen.queryByRole("button", { name: "Turn on" })).not.toBeInTheDocument();
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

  it("remembers Not now on this device, and points to Settings", async () => {
    const { unmount } = render(<PushOffer />);
    expect(await screen.findByText(/turn this on later in Settings/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    unmount();

    const { container } = render(<PushOffer />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
    expect(device.turnPushOn).not.toHaveBeenCalled();
  });

  it("tells an iPhone in a browser tab about the Home Screen app, without offering Turn on", async () => {
    device.pushSupport.mockReturnValue("ios-install");
    render(<PushOffer />);

    expect(await screen.findByText(/work only in the Home Screen app/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on" })).not.toBeInTheDocument();
    expect(screen.queryByText(/turn them on and this phone/i)).not.toBeInTheDocument();
  });

  it("still offers push once the iPhone app is installed, after the install hint was waved away", async () => {
    device.pushSupport.mockReturnValue("ios-install");
    const { unmount } = render(<PushOffer />);
    await userEvent.click(await screen.findByRole("button", { name: "Got it" }));
    unmount();

    device.pushSupport.mockReturnValue("supported");
    render(<PushOffer />);
    expect(await screen.findByRole("button", { name: "Turn on" })).toBeInTheDocument();
  });
});
