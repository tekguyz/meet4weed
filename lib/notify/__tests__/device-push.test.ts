import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(frame)/push-actions", () => ({
  saveThisDevice: vi.fn(async () => ({ ok: true })),
  forgetThisDevice: vi.fn(async () => ({ ok: true })),
}));

import { forgetThisDevice, saveThisDevice } from "@/app/(frame)/push-actions";

const saved = vi.mocked(saveThisDevice);
const forgot = vi.mocked(forgetThisDevice);

type Sub = { endpoint: string; toJSON: () => unknown; unsubscribe: ReturnType<typeof vi.fn> };

function fakeBrowser({ permission = "default" as NotificationPermission, answer = "granted" as NotificationPermission, existing = null as Sub | null } = {}) {
  let current = existing;
  const made: Sub = {
    endpoint: "https://push.example.test/new",
    toJSON: () => ({ endpoint: "https://push.example.test/new", keys: { p256dh: "k", auth: "a" } }),
    unsubscribe: vi.fn(async () => {
      current = null;
      return true;
    }),
  };
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => (current = made)),
  };
  const Notification = {
    permission,
    requestPermission: vi.fn(async () => {
      Notification.permission = answer;
      return answer;
    }),
  };
  vi.stubGlobal("Notification", Notification);
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
  return { Notification, pushManager, made };
}

async function load() {
  vi.resetModules();
  return import("@/lib/notify/device-push");
}

describe("push on this device", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    saved.mockClear();
    forgot.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("never asks the browser just to find out where things stand", async () => {
    const { Notification } = fakeBrowser();
    const { readPushState } = await load();

    expect(await readPushState()).toBe("off");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("turns on: asks, subscribes, and saves this device", async () => {
    const { pushManager } = fakeBrowser();
    const { turnPushOn } = await load();

    expect(await turnPushOn()).toBe("on");

    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(saved).toHaveBeenCalledWith({ endpoint: "https://push.example.test/new", keys: { p256dh: "k", auth: "a" } });
  });

  it("reports blocked when the member says no, and saves nothing", async () => {
    fakeBrowser({ answer: "denied" });
    const { turnPushOn, readPushState } = await load();

    expect(await turnPushOn()).toBe("blocked");
    expect(await readPushState()).toBe("blocked");
    expect(saved).not.toHaveBeenCalled();
  });

  it("says off, and drops the subscription, when the server could not save it", async () => {
    const { made } = fakeBrowser();
    saved.mockResolvedValueOnce({ ok: false });
    const { turnPushOn } = await load();

    expect(await turnPushOn()).toBe("off");
    expect(made.unsubscribe).toHaveBeenCalled();
  });

  it("turns off this device only: unsubscribes, then forgets it on the server", async () => {
    const existing: Sub = {
      endpoint: "https://push.example.test/old",
      toJSON: () => ({}),
      unsubscribe: vi.fn(async () => true),
    };
    fakeBrowser({ permission: "granted", existing });
    const { turnPushOff } = await load();

    await turnPushOff();

    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(forgot).toHaveBeenCalledWith("https://push.example.test/old");
  });

  it("re-saves an existing subscription on load, and never makes a new one", async () => {
    const { pushManager } = fakeBrowser({ permission: "granted" });
    const { resyncPush } = await load();

    await resyncPush();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
  });

  it("is unsupported with no key configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    fakeBrowser();
    const { pushSupport } = await load();
    expect(pushSupport()).toBe("unsupported");
  });
});
