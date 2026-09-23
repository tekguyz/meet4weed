"use client";

import { useEffect } from "react";
import { ErrorScreen, type ErrorPageProps } from "@/components/fallback/fallback-screens";

/** A thrown error outside the Frame, or in the Frame's own layout. */
export default function RootError({ error, retry }: ErrorPageProps) {
  useEffect(() => console.error(error), [error]);
  return <ErrorScreen onRetry={retry} />;
}
