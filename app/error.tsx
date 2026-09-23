"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/fallback/fallback-screens";

type Props = { error: Error & { digest?: string }; retry: () => void; reset: () => void };

/** A thrown error outside the Frame, or in the Frame's own layout. */
export default function RootError({ error, retry }: Props) {
  useEffect(() => console.error(error), [error]);
  return <ErrorScreen onRetry={retry} />;
}
