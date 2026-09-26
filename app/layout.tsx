import type { Metadata, Viewport } from "next";
import { APP_NAME, APP_TAGLINE, APP_URL } from "@/lib/env";
import { THEME_BOOT } from "@/lib/theme-boot";
import { fontClasses } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Makes the link-preview image (app/opengraph-image.png) an absolute URL.
  metadataBase: new URL(APP_URL),
  title: APP_NAME,
  description: APP_TAGLINE,
};

// "cover" lets the page run under a notch and a home bar, so env(safe-area-inset-*)
// reads real values. The Frame pads what it pins to an edge by exactly those.
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={fontClasses}>
      <head>
        <meta name="theme-color" content="#14120E" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
