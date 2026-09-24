import Link from "next/link";
import { FOCUS_RING } from "@/components/ui/focus";
import { APP_NAME } from "@/lib/env";

/**
 * Help, Terms, Privacy and Community rules (issue #68). Read signed out — they
 * are public in lib/supabase/session.ts — so they sit outside the Frame, which
 * needs a finished member. The name at the top goes to `/`, which sends a
 * member home and a stranger to sign in.
 */
const PAGES = [
  ["/help", "Help"],
  ["/terms", "Terms"],
  ["/privacy", "Privacy"],
  ["/rules", "Community rules"],
] as const;

const LINK = `text-sm text-ink-muted underline hover:text-ink ${FOCUS_RING}`;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-4 py-10 md:max-w-2xl">
      <header>
        <Link href="/" className={`text-base font-semibold text-ink ${FOCUS_RING}`}>
          {APP_NAME}
        </Link>
      </header>

      <main className="flex-1">{children}</main>

      <footer>
        <nav aria-label="About this app">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {PAGES.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className={LINK}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </div>
  );
}
