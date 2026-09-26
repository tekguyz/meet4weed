"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js once the page has loaded (#51), so it never competes
 * with the first paint. The worker makes the app installable, shows the
 * offline screen, and is what web push will need.
 *
 * `updateViaCache: "none"` makes the browser check for a new sw.js on every
 * load instead of trusting its HTTP cache. A failed registration is ignored:
 * the app works the same without a worker.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    };
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
