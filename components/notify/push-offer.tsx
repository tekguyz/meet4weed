"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { FOCUS_RING, TAP_TEXT } from "@/components/ui/focus";
import { PUSH_WORDS, pushSupport, turnPushOn } from "@/lib/notify/device-push";

/** Remembered per device. The iPhone card has its own key, so a member who
 *  waves it away still gets the real offer once the app is installed. */
const DISMISSED = "m4w:push-offer-dismissed";
const IOS_DISMISSED = "m4w:push-offer-ios-dismissed";

type View = "none" | "offer" | "ios" | "blocked" | "on";

function remembered(key: string): boolean {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    // Storage blocked: offer anyway, "Not now" just will not stick.
    return false;
  }
}

/** Decided without waiting on anything, so the card never pops in late and
 *  shoves the list under a thumb. Permission "default" means the browser has
 *  never been asked, so no subscription can exist yet. */
function firstView(): View {
  const support = pushSupport();
  if (support === "ios-install") return remembered(IOS_DISMISSED) ? "none" : "ios";
  if (support !== "supported" || Notification.permission !== "default") return "none";
  return remembered(DISMISSED) ? "none" : "offer";
}

/**
 * The explain-first card (#56). It shows only where a member has just earned
 * a notification — they host a sesh, or asked to join one — and only while
 * the browser has not been asked yet. The browser's own prompt comes from
 * the Turn on button and nowhere else: a cold prompt gets denied once, and
 * the browser never asks again on that device.
 */
export function PushOffer() {
  const [view, setView] = useState<View>("none");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // After mount only: the server cannot know what this browser allows.
  useEffect(() => setView(firstView()), []);

  if (view === "none") return null;

  function dismiss(key: string) {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Private mode. It hides for this visit.
    }
    setView("none");
  }

  async function turnOn() {
    setBusy(true);
    setFailed(false);
    const result = await turnPushOn().catch(() => "failed" as const);
    setBusy(false);
    if (result === "on") setView("on");
    else if (result === "blocked") setView("blocked");
    else if (result === "failed") setFailed(true);
    // "off": the member closed the prompt without choosing. The offer stays.
  }

  // The proof it worked, in place of the card, until the page changes.
  if (view === "on") {
    return (
      <Banner tone="success">
        Notifications are on for this device. You can turn them off in{" "}
        <Link href="/me/settings/notifications" className={`underline ${FOCUS_RING}`}>
          Settings
        </Link>
        .
      </Banner>
    );
  }

  return (
    <section aria-labelledby="push-offer-title" className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <h2 id="push-offer-title" className="text-lg text-balance">
        Notifications for your seshes
      </h2>

      {view === "ios" ? (
        <p className="text-sm text-ink">{PUSH_WORDS.iosInstall}</p>
      ) : (
        <>
          <p className="text-sm text-ink">
            Turn them on and this phone lets you know when someone asks to join your sesh, a host
            answers you, or a sesh you are going to changes.
          </p>
          <p className="text-sm text-ink-muted">
            The lock screen only ever says &ldquo;You have an update&rdquo; &mdash; never who, never
            which sesh. The bell always has the details.
          </p>
        </>
      )}

      {view === "blocked" ? (
        <Banner tone="warning" nested urgent>
          {PUSH_WORDS.blocked}
        </Banner>
      ) : null}
      {failed ? (
        <Banner tone="danger" nested urgent>
          {PUSH_WORDS.failed}
        </Banner>
      ) : null}

      {view === "offer" ? (
        <div className="flex flex-col items-center gap-1">
          {/* Quiet, not Sage: the page's own action keeps the one primary
              button (DESIGN.md, the One Voice Rule). */}
          <Button type="button" variant="quiet" onClick={turnOn} disabled={busy} aria-busy={busy}>
            {busy ? PUSH_WORDS.turningOn : "Turn on"}
          </Button>
          <button
            type="button"
            onClick={() => dismiss(DISMISSED)}
            className={`${TAP_TEXT} justify-center px-3 text-sm text-ink-muted underline hover:text-ink`}
          >
            Not now
          </button>
          <p className="text-xs text-ink-muted">You can turn this on later in Settings.</p>
        </div>
      ) : (
        <Button type="button" variant="quiet" onClick={() => dismiss(view === "ios" ? IOS_DISMISSED : DISMISSED)}>
          Got it
        </Button>
      )}
    </section>
  );
}
