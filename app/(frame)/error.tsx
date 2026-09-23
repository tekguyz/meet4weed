"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/fallback/fallback-screens";

type Props = { error: Error & { digest?: string }; retry: () => void; reset: () => void };

/** A thrown error in a signed-in page. The Frame stays up, so the tabs are a
 *  way out too. */
export default function FrameError({ error, retry }: Props) {
  useEffect(() => console.error(error), [error]);
  return <ErrorScreen onRetry={retry} />;
}
