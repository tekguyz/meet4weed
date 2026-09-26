"use client";

import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { IOS_INSTALL_HINT, pushSupport, readPushState, turnPushOn } from "@/lib/notify/device-push";

const DISMISSED = "m4w:push-offer-dismissed";

/**
 * The explain-first card (#56). It shows only where a member has just earned
 * a notification — they host a sesh, or asked to join one — and only while
 * the browser has not been asked yet. The browser's own prompt comes from
 * the Turn on button and nowhere else: a cold prompt gets denied once, and
 * the browser never asks again on that device.
 *
 * "Not now" is remembered on this device. Settings can still turn push on.
 */
export function PushOffer() {
  const [shown, setShown] = useState<"no" | "offer" | "ios">("no");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (localStorage.getItem(DISMISSED)) return;
      } catch {
        // Storage blocked: offer anyway, "Not now" just will not stick.
      }
      const support = pushSupport();
      if (support === "ios-install") {
        if (live) setShown("ios");
        return;
      }
      if (support !== "supported" || Notification.permission !== "default") return;
      if ((await readPushState()) === "off" && live) setShown("offer");
    })();
    return () => {
      live = false;
    };
  }, []);

  if (shown === "no") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Private mode. It hides for this visit.
    }
    setShown("no");
  }

  async function turnOn() {
    setBusy(true);
    const state = await turnPushOn().catch(() => "off" as const);
    setBusy(false);
    if (state === "on") setShown("no");
    else if (state === "blocked") setBlocked(true);
  }

  return (
    <section aria-labelledby="push-offer-title" className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <h2 id="push-offer-title" className="text-lg">
        Get a nudge when it matters
      </h2>
      <p className="text-sm text-ink">
        Turn on notifications and this phone taps you when someone asks to join your sesh, a host
        answers you, or a sesh you are going to changes.
      </p>
      <p className="text-sm text-ink-muted">
        The lock screen only ever says &ldquo;You have an update&rdquo; &mdash; never who, never which
        sesh. The bell always has the details.
      </p>
      {shown === "ios" ? (
        <p className="text-sm text-ink-muted">{IOS_INSTALL_HINT}</p>
      ) : null}
      {blocked ? (
        <Banner tone="warning" nested urgent>
          Notifications are blocked for this site. You can allow them in your browser&rsquo;s settings.
        </Banner>
      ) : null}
      <div className="flex gap-3">
        {shown === "offer" && !blocked ? (
          // Quiet, not Sage: the page's own action keeps the one primary
          // button (DESIGN.md).
          <Button type="button" variant="quiet" onClick={turnOn} disabled={busy}>
            {busy ? "Turning on…" : "Turn on"}
          </Button>
        ) : null}
        <Button type="button" variant="quiet" onClick={dismiss}>
          {shown === "offer" && !blocked ? "Not now" : "Got it"}
        </Button>
      </div>
    </section>
  );
}
