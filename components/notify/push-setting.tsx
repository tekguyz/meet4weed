"use client";

import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { readPushState, turnPushOff, turnPushOn, type PushState } from "@/lib/notify/device-push";

const SAYS: Record<PushState, string> = {
  on: "On for this device.",
  off: "Off for this device.",
  blocked:
    "Blocked in this browser. Allow notifications for this site in your browser's settings, then come back.",
  "ios-install":
    "On iPhone, add Meet4Weed to your Home Screen first: tap Share, then Add to Home Screen. Open it from there to turn notifications on.",
  unsupported: "This browser cannot show notifications. The bell still has everything.",
};

/**
 * Me → Settings → Notifications (#56). One switch, for this device only;
 * another phone keeps its own. The state is read from the browser, never
 * from the server. Pressing Turn on here is the other place the browser's
 * prompt may appear, because the member asked for it by name.
 */
export function PushSetting() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    readPushState()
      .catch(() => "unsupported" as const)
      .then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  async function toggle() {
    setBusy(true);
    const next = await (state === "on" ? turnPushOff() : turnPushOn()).catch(() => state ?? "off");
    setState(next);
    setBusy(false);
  }

  if (!state) return <p className="text-sm text-ink-muted">Checking this device…</p>;

  return (
    <div className="flex flex-col gap-3">
      <Banner tone={state === "blocked" ? "warning" : "info"}>{SAYS[state]}</Banner>
      {state === "on" || state === "off" ? (
        <Button type="button" variant={state === "on" ? "quiet" : "primary"} onClick={toggle} disabled={busy}>
          {busy ? "One moment…" : state === "on" ? "Turn off" : "Turn on"}
        </Button>
      ) : null}
    </div>
  );
}
