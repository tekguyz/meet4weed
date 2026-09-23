"use client";

import "./globals.css";
import { useEffect } from "react";
import { ErrorScreen } from "@/components/fallback/fallback-screens";
import { APP_NAME } from "@/lib/env";
import { bootTheme } from "@/lib/theme-boot";
import { fontClasses } from "./fonts";

type Props = { error: Error & { digest?: string }; retry: () => void; reset: () => void };

/**
 * The last resort, when the root layout itself throws. It REPLACES that
 * layout, so it brings its own document, styles, fonts and theme.
 *
 * The theme comes from an effect, not the root layout's inline script: this
 * page renders on the client, and React never runs a script it renders there.
 * Dark shows for a moment first, which is the default anyway.
 */
export default function GlobalError({ error, retry }: Props) {
  useEffect(() => console.error(error), [error]);
  useEffect(bootTheme, []);

  return (
    <html lang="en" suppressHydrationWarning className={fontClasses}>
      <head>
        <title>{`Something went wrong · ${APP_NAME}`}</title>
      </head>
      <body>
        <ErrorScreen onRetry={retry} />
      </body>
    </html>
  );
}
