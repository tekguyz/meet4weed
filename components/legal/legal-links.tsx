import Link from "next/link";
import type { ReactNode } from "react";
import { FOCUS_RING } from "@/components/ui/focus";

/**
 * Links to what a person agrees to, at the moment they agree (issue #68). Each
 * opens a new tab: the form beside it holds what the person has typed or
 * ticked, and a same-tab visit would throw it away.
 */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" className={`text-primary underline ${FOCUS_RING}`}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}

/** "Terms, Privacy and Community rules", linked, after a lead-in sentence. */
export function AgreementLinks({ lead }: { lead: string }) {
  return (
    <p className="text-xs text-ink-muted">
      {lead} <LegalLink href="/terms">Terms</LegalLink>, <LegalLink href="/privacy">Privacy</LegalLink> and{" "}
      <LegalLink href="/rules">Community rules</LegalLink>.
    </p>
  );
}
