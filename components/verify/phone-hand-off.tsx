"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

/** The page's own address never changes, so there is nothing to subscribe to. */
const noSubscription = () => () => {};

/**
 * For a device with no camera. Verification is live-camera only (spec §4.1),
 * so the way forward is the member's phone: say so, and show the link to type
 * or send there. No QR code in v1.
 *
 * The link is built in the browser, from the address the member is actually
 * on, so it is right on localhost, a preview and production alike. The server
 * has no such address, so it renders without one.
 */
export function PhoneHandOff() {
  const link = useSyncExternalStore(
    noSubscription,
    () => `${window.location.origin}/verify`,
    () => null,
  );
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // The link is on screen to select by hand; a failed copy loses nothing.
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-card bg-surface p-4">
      <p className="text-sm text-ink">
        We cannot find a camera on this device. Verifying needs a live photo of your card, so open this page on your
        phone and sign in there.
      </p>
      {link ? (
        <>
          <p className="rounded-control bg-surface-2 px-3 py-2 text-center font-mono text-sm break-all text-ink select-all">
            {link}
          </p>
          <Button type="button" onClick={copy}>
            {copied ? "Copied" : "Copy the link"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
