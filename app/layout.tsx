import type { Metadata, Viewport } from "next";
import { APP_NAME, APP_TAGLINE, APP_URL } from "@/lib/env";
import { THEME_BOOT } from "@/lib/theme-boot";
import { ServiceWorker } from "@/components/service-worker";
import { fontClasses } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Makes the link-preview image (app/opengraph-image.png) an absolute URL.
  metadataBase: new URL(APP_URL),
  title: APP_NAME,
  description: APP_TAGLINE,
  // The page runs under the iPhone status bar, the way it runs under Android's
  // with viewport-fit=cover. The Frame's header pads by the safe-area inset.
  appleWebApp: { statusBarStyle: "black-translucent" },
};

// "cover" lets the page run under a notch and a home bar, so env(safe-area-inset-*)
// reads real values. The Frame pads what it pins to an edge by exactly those.
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={fontClasses}>
      <head>
        {/* Also writes the theme-color meta, from the live --bg token. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
