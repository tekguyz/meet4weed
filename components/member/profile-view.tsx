import type { PublicProfile } from "@/lib/profiles/schema";

/**
 * One member's profile (issue #64). It takes a PublicProfile and nothing else.
 *
 * It never lists seshes — not hosted, not attended. A list of where someone
 * went is a guest list, and a guest list is what the address model exists to
 * keep. There is no prop for them, so there is nothing to render by accident.
 *
 * The card status is on PublicProfile but is not shown: whether somebody's
 * card is current is between them and the reviewer.
 */
export function ProfileView({ profile, isMe }: { profile: PublicProfile; isMe: boolean }) {
  return (
    <article className="flex flex-col gap-6">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-3xl">@{profile.handle}</h1>
        {profile.displayName ? <p className="truncate text-ink-muted">{profile.displayName}</p> : null}
        {profile.city ? <p className="text-sm text-ink-muted">{profile.city}</p> : null}
        {isMe ? (
          <p className="text-sm text-ink-muted">This is how other members see you.</p>
        ) : null}
      </header>

      {profile.bio ? <p className="text-sm whitespace-pre-line text-ink">{profile.bio}</p> : null}

      <Tags title="Strains" values={profile.strainPrefs} />
      <Tags title="How they consume" values={profile.methodPrefs} />
      <Tags title="Vibe" values={profile.vibeTags} />
    </article>
  );
}

/** Display-only tags, not chips: DESIGN.md says a chip is a link. */
function Tags({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-ink-muted">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {values.map((value) => (
          <li key={value} className="rounded-control bg-surface-2 px-3 py-2 text-sm capitalize text-ink">
            {value}
          </li>
        ))}
      </ul>
    </section>
  );
}
