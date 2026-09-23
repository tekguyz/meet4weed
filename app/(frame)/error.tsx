"use client";

import { useEffect } from "react";
import { ErrorScreen, type ErrorPageProps } from "@/components/fallback/fallback-screens";

/** A thrown error in a signed-in page. The Frame stays up, so the tabs are a
 *  way out too. */
export default function FrameError({ error, retry }: ErrorPageProps) {
  useEffect(() => console.error(error), [error]);
  return <ErrorScreen onRetry={retry} framed />;
}
