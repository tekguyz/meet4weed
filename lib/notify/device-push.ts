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

/** What this device can do before anything is asked. */
/** One sentence, used by the offer card and by Settings. */
export const IOS_INSTALL_HINT =
  "On iPhone, add Meet4Weed to your Home Screen first: tap Share, then Add to Home Screen. Open it from there to turn notifications on.";

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

/** Asks the browser — call it only from a button press. */
export async function turnPushOn(): Promise<PushState> {
  const support = pushSupport();
  if (support !== "supported") return support;
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";

  const reg = await registration();
  if (!reg) return "off";
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
  // Not saved means no push would ever arrive. Say "off", truthfully.
  await subscription.unsubscribe().catch(() => {});
  return "off";
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
