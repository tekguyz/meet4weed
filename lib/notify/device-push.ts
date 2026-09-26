import { forgetThisDevice, saveThisDevice } from "@/app/(frame)/push-actions";

/**
 * Push on this device, from the browser's side (#56). "Are notifications
 * on?" is answered here, by the browser's own subscription, never by reading
 * the server's table back — a member cannot read that table at all.
 *
 * The browser's permission prompt is shown only from turnPushOn(), which only
 * a button press calls, after the explain-first card. A cold prompt gets
 * denied once, and the browser never asks again on that device.
 */
export type PushState =
  /** No push in this browser, or no key configured. */
  | "unsupported"
  /** iPhone or iPad in a browser tab: push needs the app on the Home Screen. */
  | "ios-install"
  /** The member said no to the browser, which will not ask again. */
  | "blocked"
  | "off"
  | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; the touch points give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isInstalled(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function canPush(): boolean {
  return Boolean(PUBLIC_KEY) && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** The words both screens share, so they never drift apart. */
export const PUSH_WORDS = {
  iosInstall:
    "On iPhone, notifications work only in the Home Screen app. In Safari, tap Share, then Add to Home Screen, and open Meet4Weed from there.",
  // An installed app has no browser settings the member can see, so the
  // steps name the phone's own screen first.
  blocked:
    "Notifications are blocked for Meet4Weed on this phone. To allow them, long-press the Meet4Weed icon, tap App info, then Notifications. In a browser tab, use the site's settings instead.",
  failed: "Could not turn on notifications. Check your connection and try again.",
  turningOn: "Turning on…",
} as const;

/** What this device can do before anything is asked. */
export function pushSupport(): "supported" | "ios-install" | "unsupported" {
  if (canPush()) return "supported";
  if (PUBLIC_KEY && isAppleMobile() && !isInstalled()) return "ios-install";
  return "unsupported";
}

/** The worker registers after load; give it a moment, then give up. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), 10_000)));
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function readPushState(): Promise<PushState> {
  const support = pushSupport();
  if (support !== "supported") return support;
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  return (await currentSubscription()) ? "on" : "off";
}

/** The push service wants the key as bytes; it travels as base64url. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return true; // Browsers that do not report it: trust the subscription.
  const bytes = new Uint8Array(a);
  return bytes.length === b.length && bytes.every((v, i) => v === b[i]);
}

/** What pressing Turn on can end in. "failed" means the member said yes
 *  but something between here and the server did not work; the screen must
 *  say so, never quietly show "off". */
export type TurnOnResult = PushState | "failed";

/** Asks the browser — call it only from a button press. */
export async function turnPushOn(): Promise<TurnOnResult> {
  const support = pushSupport();
  if (support !== "supported") return support;
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";
  try {
    return await subscribeAndSave();
  } catch {
    return "failed";
  }
}

async function subscribeAndSave(): Promise<TurnOnResult> {
  const reg = await registration();
  if (!reg) return "failed";
  const key = keyBytes(PUBLIC_KEY!);
  let subscription = await reg.pushManager.getSubscription();
  // Made under an older key pair, it can never be pushed to again.
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe().catch(() => {});
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  const { ok } = await saveThisDevice(subscription.toJSON());
  if (ok) return "on";
  // Not saved means no push would ever arrive. Drop it and say so.
  await subscription.unsubscribe().catch(() => {});
  return "failed";
}

/** Stops push on this device only. The browser side goes first, so pushes
 *  stop even if the server cannot be reached; the next push to the dead
 *  subscription gets a 410, and the server deletes its row then. */
export async function turnPushOff(): Promise<PushState> {
  const subscription = await currentSubscription();
  if (subscription) {
    const { endpoint } = subscription;
    await subscription.unsubscribe().catch(() => {});
    await forgetThisDevice(endpoint).catch(() => {});
  }
  return readPushState();
}

/**
 * Saves this device's existing subscription again, once per app load. It
 * moves the device to whoever is signed in now, and refreshes a row the
 * server lost. It never subscribes: a member who turned push off keeps the
 * browser's permission, and must stay off.
 */
export async function resyncPush(): Promise<void> {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return;
  const subscription = await currentSubscription();
  if (subscription) await saveThisDevice(subscription.toJSON()).catch(() => {});
}
