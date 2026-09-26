"use client";

import { useEffect } from "react";
import { resyncPush } from "@/lib/notify/device-push";

/** Once per app load, re-saves this device's existing push subscription, so
 *  a shared phone follows whoever is signed in and a lost row comes back.
 *  Never asks the browser anything. */
export function PushSync() {
  useEffect(() => {
    resyncPush().catch(() => {});
  }, []);
  return null;
}
