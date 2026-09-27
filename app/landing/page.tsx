import type { Metadata } from "next";
import Link from "next/link";
import { DemoButton } from "@/components/demo/demo-button";
import { CircleMark } from "@/components/landing/landing-map";
import { FINE_PRINT } from "@/components/legal/fine-print";
import { Story } from "@/components/landing/story";
import { buttonClass } from "@/components/ui/button";
import { FOCUS_RING, TAP_TEXT } from "@/components/ui/focus";
import { APP_NAME } from "@/lib/env";
import { demoModeEnabled } from "@/lib/server-env";

/**
 * The landing page (#97). A signed-out visitor on exactly `/` is served this
 * route by the proxy (lib/supabase/session.ts); the URL stays `/`, and a direct
 * request here goes to `/`. It sits outside the Frame, which needs a finished
 * member. Static: it reads nothing and holds nothing about anyone. The one
 * setting it reads, the demo flag (#39), is read when it is built.
 *
 * Every claim below is true in the code today. A new one is checked against
 * the code before it goes here (#97, "Allowed claims").
 */

const TITLE = `${APP_NAME}: meet verified Florida patients, privately`;
const DESCRIPTION =
  "A private place for verified Florida OMMU medical cannabis cardholders, 21 and over, to meet at each other's homes. A person checks every card. The host approves every guest.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // The one page search engines index. The root layout's default is noindex.
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  // No openGraph or twitter block: Next builds the link-preview tags from the
  // title and description above, with app/opengraph-image.png (rendered by
  // `npm run icons`). A block here replaces the root's and drops the image.
};

const SIGN_UP = "/login?mode=sign-up";

/** The three checks. `label` names each one in the map's legend. */
const CHECKS = [
  {
    label: "Card",
    title: "Your card and face, captured live",
    body: "You photograph your card from Florida’s Office of Medical Marijuana Use (OMMU), then a photo of you holding it while you follow a prompt picked at random. An old photo will not match the prompt.",
  },
  {
    label: "Person",
    title: "A person approves every member",
    body: "Software reads the card to help, but it never approves anyone. A person looks at both photos and decides.",
  },
  {
    label: "Host",
    title: "The host approves every guest",
    body: "Until then, a sesh shows only a shaded circle about half a mile across, never the house. The host decides who comes in.",
  },
] as const;

const PROMISES = [
  {
    title: "Never a sale",
    body: `${APP_NAME} is a place to meet. Nothing is sold through it, ever.`,
  },
  {
    title: "Your photos are deleted",
    body: "Card and face photos are deleted when the reviewer decides, and within 7 days at most.",
  },
  {
    title: "Your lock screen stays quiet",
    body: "A push notification names no member and no sesh.",
  },
] as const;

const QUIET_LINK = `${TAP_TEXT} text-sm text-ink-muted underline hover:text-ink`;

/** The demo door (#39), under Sign up. Renders nothing when the flag is off.
 *  The page stays static, so the flag is read when it is built; the action
 *  reads it again on every press, so a stale button opens nothing. */
function DemoSlot() {
  if (!demoModeEnabled()) return null;
  return <DemoButton />;
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Without JavaScript the story never moves, so show where it ends.
          Undoes the data-on rule in app/globals.css; change both. */}
      <noscript>
        <style>{"[data-story] [data-on=false]{opacity:1;transform:none}"}</style>
      </noscript>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 md:px-8">
        <span translate="no" className="text-base font-semibold text-ink">
          {APP_NAME}
        </span>
        <Link href="/login" className={`${TAP_TEXT} justify-center px-2 text-sm font-semibold text-ink underline-offset-4 hover:underline`}>
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 md:px-8 md:pt-6">
        <Story checks={CHECKS.map((check) => check.label)}>
          {/* Sign up must show without scrolling at 320 × 568 and on a phone
              on its side, so the big type waits for a tall screen. */}
          <section className="flex flex-col gap-3 px-4 pt-5 pb-12 md:px-0 md:pt-4 md:pb-20 md:tall:pt-16">
            <h1 className="text-balance text-[clamp(1.625rem,7.5vw,1.875rem)] leading-tight md:tall:text-5xl">
              The address stays hidden until the host says yes.
            </h1>
            <p className="text-base text-ink-muted md:tall:text-lg">
              Seshes are small private gatherings at members’ homes, for verified Florida OMMU
              medical cannabis cardholders, 21 and over.
            </p>
            <Link href={SIGN_UP} className={`${buttonClass("primary")} ${FOCUS_RING} mt-2 md:max-w-xs`}>
              Sign up
            </Link>
            <DemoSlot />
          </section>

          <section aria-labelledby="checks" className="px-4 pb-16 md:px-0 md:pb-32">
            <h2 id="checks" className="text-xl text-balance md:text-2xl">
              Three checks, then the address
            </h2>
            <ol className="mt-2 flex flex-col">
              {CHECKS.map((check, i) => (
                <li key={check.title} data-story-step className="flex gap-4 border-b border-rule py-8 md:py-16">
                  <span aria-hidden="true" className="w-5 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-ink-muted">
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg text-balance">{check.title}</h3>
                    <p className="text-base text-ink-muted">{check.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {/* Not a fourth check: what the three open. The map drops its pin here. */}
            <div data-story-step className="flex flex-col gap-2 pt-8 md:pt-16 md:pl-9">
              <h3 className="text-lg text-balance">Then the address, for a while</h3>
              <p className="text-base text-ink-muted">
                Once the host says yes, you see the exact address. It closes 12 hours after the sesh starts.
                After 7 days the app deletes it for good.
              </p>
            </div>
          </section>
        </Story>

        <section aria-labelledby="promises" className="px-4 py-12 md:px-0 md:py-20">
          <h2 id="promises" className="text-xl text-balance md:text-2xl">
            Three plain promises
          </h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-3 md:gap-10">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="flex flex-col gap-2">
                <h3 className="text-lg text-balance">{promise.title}</h3>
                <p className="text-base text-ink-muted">{promise.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="join"
          className="mx-4 mb-12 flex flex-col gap-4 rounded-card bg-surface p-6 md:mx-0 md:mb-20 md:items-start md:p-10"
        >
          <CircleMark className="size-12" />
          <h2 id="join" className="text-xl text-balance md:text-2xl">
            A Florida OMMU cardholder, 21 or over?
          </h2>
          <p className="text-base text-ink-muted">Sign up, and a person will check your card.</p>
          <Link href={SIGN_UP} className={`${buttonClass("primary")} ${FOCUS_RING} md:max-w-xs`}>
            Sign up
          </Link>
          <p className="text-sm text-ink-muted">
            Already a member?{" "}
            <Link href="/login" className={`font-semibold text-ink underline hover:text-ink-muted ${FOCUS_RING}`}>
              Sign in
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8">
          <nav aria-label="About this app">
            <ul className="flex flex-wrap gap-x-4">
              {FINE_PRINT.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className={QUIET_LINK}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-xs text-ink-muted">
            Built by{" "}
            <a href="https://tekguyz.com" className={`${TAP_TEXT} underline hover:text-ink`}>
              TEKGUYZ
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
