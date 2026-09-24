"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { Avatar } from "@/components/member/avatar";
import { FOCUS_RING } from "@/components/ui/focus";
import { APP_NAME } from "@/lib/env";
import type { FrameTab } from "@/lib/member/gate";
import { activeTab, frameHeader, TABS } from "./frame-paths";

/**
 * The Frame (issue #62; brief in .impeccable/surfaces/route-me.md). It renders
 * the tabs it is given and decides nothing — frameAccess() in lib/member/gate.ts
 * does. On a phone: a thin header naming the page, and a bottom tab bar. From
 * `md` up: no bottom bar, the same tabs in the header.
 *
 * There is ONE nav element. On a phone it is pinned to the bottom; from `md` up
 * it sits in the header. Two copies would put two "Main" landmarks in front of
 * a screen reader.
 */
export function Frame({
  tabs,
  avatar,
  children,
}: {
  tabs: FrameTab[];
  /** The signed-in member's Avatar, drawn on the Me tab (issue #69). */
  avatar?: Omit<ComponentProps<typeof Avatar>, "className">;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = activeTab(pathname);
  const { title, back } = frameHeader(pathname);

  return (
    <div data-frame>
      <a
        href="#content"
        className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-30 focus:rounded-control focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-on-primary ${FOCUS_RING}`}
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 bg-bg pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-4 md:max-w-3xl">
          <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
            {back ? (
              <Link
                href={back}
                aria-label="Back"
                className={`-ml-3 flex size-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:text-ink ${FOCUS_RING}`}
              >
                <BackIcon />
              </Link>
            ) : null}
            <p className="truncate text-base font-semibold text-ink">{title}</p>
          </div>

          <Link
            href="/"
            className={`hidden shrink-0 rounded-control text-base font-semibold text-ink md:mr-4 md:block ${FOCUS_RING}`}
          >
            {APP_NAME}
          </Link>

          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-20 bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] md:static md:flex-1 md:bg-transparent md:p-0"
          >
            <ul className="mx-auto flex max-w-md md:max-w-none md:gap-1">
              {tabs.map((tab) => {
                const here = tab === current;
                return (
                  <li key={tab} className="flex-1 md:flex-none">
                    <Link
                      href={TABS[tab].href}
                      aria-current={here ? "page" : undefined}
                      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-control text-xs font-medium md:min-h-11 md:flex-row md:gap-2 md:px-3 md:text-sm ${here ? "text-primary" : "text-ink-muted hover:text-ink"} ${FOCUS_RING}`}
                    >
                      {tab === "me" && avatar ? (
                        <Avatar {...avatar} className="size-6 md:size-5" />
                      ) : (
                        <TabIcon tab={tab} />
                      )}
                      {TABS[tab].label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Plan 05's bell. The space is held now so the title does not jump
              when it arrives. */}
          <div className="size-11 shrink-0" data-slot="bell" />
        </div>
      </header>

      <main
        id="content"
        tabIndex={-1}
        className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] outline-none md:pb-0"
      >
        {children}
      </main>
    </div>
  );
}

function Svg({ children, className = "size-6 md:size-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

function BackIcon() {
  return (
    <Svg className="size-6">
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

/** Simple line icons, decorative: every tab carries its own label. No leaf. */
function TabIcon({ tab }: { tab: FrameTab }) {
  switch (tab) {
    case "seshes":
      return (
        <Svg>
          <path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" />
          <path d="M9 4v13.5M15 6.5V20" />
        </Svg>
      );
    case "mine":
      return (
        <Svg>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </Svg>
      );
    case "new":
      return (
        <Svg>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v8M8 12h8" />
        </Svg>
      );
    case "me":
      return (
        <Svg>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20c1.2-3.5 3.8-5.5 7-5.5s5.8 2 7 5.5" />
        </Svg>
      );
  }
}
