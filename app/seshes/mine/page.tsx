import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/profiles/queries";
import { listMySeshes, type SeshListItem } from "@/lib/sesh/queries";
import { SESH_TYPE_LABELS } from "@/lib/sesh/schema";

/** Florida time, because that is the time the host typed. */
const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function MySeshesPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const seshes = await listMySeshes();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl">Hosting</h1>
        <Link href="/seshes/new" className="text-sm font-semibold text-primary underline">
          Host a sesh
        </Link>
      </header>

      {seshes.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing yet. When you host one, it shows up here with who has asked to come.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {seshes.map((sesh) => (
            <li key={sesh.id}>
              <SeshCard sesh={sesh} />
            </li>
          ))}
        </ul>
      )}

      <Link href="/" className="text-sm text-ink-muted underline">
        Back
      </Link>
    </main>
  );
}

function SeshCard({ sesh }: { sesh: SeshListItem }) {
  const cancelled = sesh.status === "cancelled";

  return (
    <article className={`flex flex-col gap-1 rounded-card bg-surface p-4 ${cancelled ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg">{sesh.title}</h2>
        <span className="shrink-0 rounded-control bg-surface-2 px-2 py-1 text-xs text-ink-muted">
          {SESH_TYPE_LABELS[sesh.seshType]}
        </span>
      </div>
      <p className="text-sm text-ink-muted">{WHEN.format(new Date(sesh.startsAt))} ET</p>
      <p className="text-sm text-ink-muted">
        {cancelled ? "Cancelled" : `Room for ${sesh.capacity} guest${sesh.capacity === 1 ? "" : "s"}`}
      </p>
    </article>
  );
}
