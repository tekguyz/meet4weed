import { profilePath } from "@/components/member/handle-link";
import { WhereYouStand } from "@/components/member/where-you-stand";
import { SignOutButton } from "@/components/member/sign-out-button";
import { RowGroup, RowLink } from "@/components/ui/row-list";
import type { Standing } from "@/lib/member/standing";

type Props = {
  handle: string;
  displayName: string | null;
  standing: Standing;
  /** frameAccess()'s answer. This view decides nothing. */
  adminLink: boolean;
  version: string;
};

/**
 * Me (issue #65, shape brief `.impeccable/surfaces/route-me.md` §6): who I am
 * and where my card stands, then one row for everything else.
 */
export function MeView({ handle, displayName, standing, adminLink, version }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-3xl">@{handle}</h1>
        {displayName ? <p className="truncate text-sm text-ink-muted">{displayName}</p> : null}
      </header>

      <WhereYouStand standing={standing} />

      <RowGroup>
        <RowLink href={profilePath(handle)}>See your profile as others see it</RowLink>
        <RowLink href="/me/settings">Settings</RowLink>
      </RowGroup>

      {/* /help, /terms, /privacy and /rules land with their own ticket (#68). */}
      <RowGroup>
        <RowLink href="/help">Help</RowLink>
        <RowLink href="/terms">Terms</RowLink>
        <RowLink href="/privacy">Privacy</RowLink>
        <RowLink href="/rules">Community rules</RowLink>
      </RowGroup>

      {adminLink ? (
        <RowGroup>
          <RowLink href="/admin">Admin</RowLink>
        </RowGroup>
      ) : null}

      <SignOutButton />

      <p className="text-xs text-ink-muted">About: version {version}</p>
    </div>
  );
}
