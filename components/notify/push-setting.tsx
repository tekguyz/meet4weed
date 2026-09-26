"use client";

import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { PUSH_WORDS, readPushState, turnPushOff, turnPushOn, type PushState } from "@/lib/notify/device-push";

const SAYS: Record<PushState, string> = {
  on: "On for this device.",
  off: "Off for this device.",
  blocked: PUSH_WORDS.blocked,
  "ios-install": PUSH_WORDS.iosInstall,
  unsupported: "This browser cannot show notifications. The bell still has everything.",
};

/**
 * Me → Settings → Notifications (#56). One switch, for this device only;
 * another phone keeps its own. The state is read from the browser, never
 * from the server. Pressing Turn on here is the other place the browser's
 * prompt may appear, because the member asked for it by name.
 *
 * The state is a plain line, not a notice: it is a setting, not news. A
 * notice appears only when something went wrong.
 */
export function PushSetting() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const check = () =>
      readPushState()
        .catch(() => "unsupported" as const)
        .then((s) => live && setState(s));
    check();
    // "Blocked" sends the member to the phone's settings. When they come
    // back, show what they changed without a reload.
    const onReturn = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, []);

  async function toggle() {
    setBusy(true);
    setFailed(false);
    if (state === "on") {
      setState(await turnPushOff().catch(() => readPushState()));
    } else {
      const result = await turnPushOn().catch(() => "failed" as const);
      if (result === "failed") {
        setFailed(true);
        setState(await readPushState().catch(() => state ?? "off"));
      } else {
        setState(result);
      }
    }
    setBusy(false);
  }

  if (!state) return <p className="text-sm text-ink-muted">Checking this device…</p>;

  const canToggle = state === "on" || state === "off";
  return (
    <div className="flex flex-col gap-3">
      {state === "blocked" ? (
        <Banner tone="warning">{SAYS.blocked}</Banner>
      ) : (
        <p className="text-sm text-ink">{SAYS[state]}</p>
      )}
      {failed ? (
        <Banner tone="danger" urgent>
          {PUSH_WORDS.failed}
        </Banner>
      ) : null}
      {canToggle ? (
        <Button
          type="button"
          variant={state === "on" ? "quiet" : "primary"}
          onClick={toggle}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (state === "on" ? "Turning off…" : PUSH_WORDS.turningOn) : state === "on" ? "Turn off" : "Turn on"}
        </Button>
      ) : null}
    </div>
  );
}
