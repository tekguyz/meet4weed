import Image from "next/image";
import Link from "next/link";
import { Banner } from "@/components/ui/banner";
import { CHECKS, PROMISES } from "@/components/landing/copy";
import { FOCUS_RING, TAP_TEXT } from "@/components/ui/focus";
import { safeNext } from "@/lib/auth/safe-next";
import { APP_NAME, APP_TAGLINE } from "@/lib/env";
import pictureDark from "@/showcase/seshes-desktop-dark.png";
import pictureLight from "@/showcase/seshes-desktop-light.png";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

/** The brand panel's bullets are the landing page's own headings (components/
 *  landing/copy.ts). No new copy: DEMO-STANDARD.md, "Sign-in page". */
const BULLETS = [CHECKS[1].title, CHECKS[2].title, PROMISES[1].title];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const { next, error, mode } = await searchParams;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 lg:mx-0 lg:max-w-none lg:items-center lg:px-12">
        <div className="flex w-full flex-col gap-8 lg:max-w-sm">
          {/* Phone width: the form only. On a wide screen the brand panel names the app. */}
          <header className="flex flex-col gap-2 lg:hidden">
            <h1 className="text-3xl">{APP_NAME}</h1>
            {/* Issue #68: a stranger who opens a shared link lands here first. */}
            <p className="text-sm text-ink-muted">{APP_TAGLINE}</p>
          </header>
          <h1 className="hidden text-3xl lg:block">Sign in</h1>

          {/* Set only by app/auth/actions/email-link.ts. */}
          {error === "link_invalid" ? (
            <Banner tone="danger" urgent>
              That link is wrong, used or expired. Ask for a new one.
            </Banner>
          ) : null}

          {/* Set by app/(frame)/seshes/invite-actions.ts when somebody with no account
              presses an invite button. It carries NO token — the token is in an
              httpOnly cookie, and a query string is exactly where it must not be. */}
          <LoginForm next={safeNext(next)} signUp={mode === "sign-up"} />

          <p className="text-xs text-ink-muted">
            Every member's card is checked by a person. {APP_NAME} is a place to meet, never a place to
            buy or sell.{" "}
            {/* #97: the sign-in page is not a dead end for a stranger. On a wide
                screen the brand panel carries the link instead. */}
            <Link href="/" className={`text-ink underline hover:text-ink-muted lg:hidden ${FOCUS_RING}`}>
              What is {APP_NAME}?
            </Link>
          </p>
        </div>
      </main>

      {/* Wide screens only. Kept light: name, one line, three bullets, one real
          capture, one plain link. No demo button: the demo door stays on the
          landing page (#126). */}
      <aside
        aria-label={`About ${APP_NAME}`}
        className="hidden min-h-dvh flex-col gap-8 border-l border-rule bg-surface p-12 lg:flex"
      >
        <div className="flex flex-col gap-3">
          <p translate="no" className="font-display text-3xl font-semibold">
            {APP_NAME}
          </p>
          <p className="max-w-md text-base text-ink-muted">{APP_TAGLINE}</p>
        </div>

        <ul className="flex flex-col gap-2 text-base">
          {BULLETS.map((line) => (
            <li key={line} className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {line}
            </li>
          ))}
        </ul>

        {/* A real capture from showcase/, in the member's own theme. */}
        <div className="min-h-0 flex-1">
          <Image
            src={pictureDark}
            alt="The seshes list in the app"
            sizes="(min-width: 1024px) 45vw, 0px"
            className="w-full rounded-card border border-rule object-cover object-top in-[.light]:hidden"
          />
          <Image
            src={pictureLight}
            alt="The seshes list in the app"
            sizes="(min-width: 1024px) 45vw, 0px"
            className="hidden w-full rounded-card border border-rule object-cover object-top in-[.light]:block"
          />
        </div>

        <Link href="/" className={`${TAP_TEXT} self-start text-base font-semibold text-ink underline underline-offset-4 hover:text-ink-muted`}>
          Just looking? See what it does →
        </Link>
      </aside>
    </div>
  );
}
