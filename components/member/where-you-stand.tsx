import Link from "next/link";
import type { ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { FOCUS_RING } from "@/components/ui/focus";
import type { Standing } from "@/lib/member/standing";

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The where-you-stand card (issue #62): one card per state, each with its next
 * step. It renders the state standing() worked out and decides nothing.
 * `/` shows it to a member who cannot browse; the feed shows it as a notice.
 */
export function WhereYouStand({ standing }: { standing: Standing }) {
  switch (standing.kind) {
    case "verified":
      return (
        <Card title="Your card is verified">
          <Body>Valid through {LONG_DATE.format(new Date(`${standing.expiresOn}T00:00:00Z`))}.</Body>
        </Card>
      );
    case "expiring":
      return (
        <Banner tone="warning">
          {standing.notice}{" "}
          <Link href="/verify" className={`underline ${FOCUS_RING}`}>
            Renew
          </Link>
        </Banner>
      );
    case "expired":
      return (
        <Card title="Your card has expired">
          <Body>
            Your account is read-only. You can browse seshes and see your history, but not join or host.
          </Body>
          <Step href="/verify">Renew your card</Step>
        </Card>
      );
    case "pending":
      return (
        <Card title="A person is checking your card">
          <Body>Seshes open up as soon as they are done. Your photos are deleted when they decide.</Body>
        </Card>
      );
    case "rejected":
      return (
        <Card title="Your card was not approved">
          {standing.reason ? <p className="text-sm text-danger">{standing.reason}</p> : null}
          <Body>
            <HelpLink>Help</HelpLink> lists the common reasons. Fix it, then send it again.
          </Body>
          <Step href="/verify">Try again</Step>
        </Card>
      );
    case "retake":
      return (
        <Card title="Please take your photos again">
          {standing.reason ? <p className="text-sm text-secondary">{standing.reason}</p> : null}
          <Step href="/verify">Retake photos</Step>
        </Card>
      );
    case "lapsed":
      return (
        <Card title="Please take your photos again">
          <Body>Nobody reviewed your last photos in time, so they were deleted.</Body>
          <Step href="/verify">Take them again</Step>
        </Card>
      );
    case "unverified":
      return (
        <Card title="Verify your card">
          <Body>Seshes are for verified patients. Add your card and a person will check it.</Body>
          <Step href="/verify">Verify your card</Step>
        </Card>
      );
    case "suspended":
      return (
        <Card title="This account is suspended">
          <Body>
            If you think this is a mistake, <HelpLink>get help</HelpLink>.
          </Body>
        </Card>
      );
  }
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

function Step({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${buttonClass()} ${FOCUS_RING}`}>
      {children}
    </Link>
  );
}

/** /help lands with its own ticket (#68). */
function HelpLink({ children }: { children: ReactNode }) {
  return (
    <Link href="/help" className={`text-primary underline ${FOCUS_RING}`}>
      {children}
    </Link>
  );
}
