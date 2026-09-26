import { OfflineScreen } from "@/components/fallback/fallback-screens";

export const metadata = { title: "You are offline" };

/** The one page the service worker caches (public/sw.js, ADR 0001). It must
 *  stay static: whatever it read would be frozen on the device. */
export default function OfflinePage() {
  return <OfflineScreen />;
}
