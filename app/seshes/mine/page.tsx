import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/profiles/queries";
import {
  listMyGoing,
  listMySeshes,
  pendingCounts,
  type RsvpStatus,
  type SeshListItem,
} from "@/lib/sesh/queries";
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

  const [hosting, going] = await Promise.all([listMySeshes(), listMyGoing()]);
  const pending = await pendingCounts(hosting.map((sesh) => sesh.id));

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl">My seshes</h1>
        <Link href="/seshes/new" className="text-sm font-semibold text-primary underline">
          Host a sesh
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Hosting</h2>
        {hosting.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing yet. When you host one, it shows up here with who has asked to come.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {hosting.map((sesh) => (
              <li key={sesh.id}>
                <HostingCard sesh={sesh} waiting={pending[sesh.id] ?? 0} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Going</h2>
        {going.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing yet.{" "}
            <Link href="/seshes" className="underline">
              Find a sesh
            </Link>{" "}
            and ask to come.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {going.map(({ sesh, status }) => (
              <li key={sesh.id}>
                <GoingCard sesh={sesh} status={status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/" className="text-sm text-ink-muted underline">
        Back
      </Link>
    </main>
  );
}

function Summary({ sesh }: { sesh: SeshListItem }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg">{sesh.title}</h3>
        <span className="shrink-0 rounded-control bg-surface-2 px-2 py-1 text-xs text-ink-muted">
          {SESH_TYPE_LABELS[sesh.seshType]}
        </span>
      </div>
      <p className="text-sm text-ink-muted">{WHEN.format(new Date(sesh.startsAt))} ET</p>
    </>
  );
}

function HostingCard({ sesh, waiting }: { sesh: SeshListItem; waiting: number }) {
  const cancelled = sesh.status === "cancelled";
  const left = Math.max(sesh.capacity - sesh.approvedCount, 0);

  return (
    <article className={`flex flex-col gap-1 rounded-card bg-surface p-4 ${cancelled ? "opacity-60" : ""}`}>
      <Summary sesh={sesh} />
      <p className="text-sm text-ink-muted">
        {sesh.areaName ? `${sesh.areaName} · ` : ""}
        {cancelled ? "Cancelled" : left === 0 ? "full" : `${left} spot${left === 1 ? "" : "s"} left`}
      </p>

      {/* The only way a host learns somebody is waiting, in this plan. Email
          and push are step 9 of the build order. */}
      {!cancelled && waiting > 0 ? (
        <p className="text-sm font-semibold text-secondary">
          {waiting} {waiting === 1 ? "person is" : "people are"} waiting on you
        </p>
      ) : null}

      <div className="flex gap-4">
        <Link href={`/seshes/${sesh.id}`} className="text-sm font-semibold text-primary underline">
          {waiting > 0 && !cancelled ? "Review requests" : "Open"}
        </Link>
        {cancelled ? null : (
          <Link href={`/seshes/${sesh.id}/edit`} className="text-sm text-ink-muted underline">
            Edit
          </Link>
        )}
      </div>
    </article>
  );
}

function GoingCard({ sesh, status }: { sesh: SeshListItem; status: RsvpStatus }) {
  const cancelled = sesh.status === "cancelled";

  return (
    <article className={`flex flex-col gap-1 rounded-card bg-surface p-4 ${cancelled ? "opacity-60" : ""}`}>
      <Summary sesh={sesh} />
      <p className="text-sm text-ink-muted">
        {sesh.areaName ? `${sesh.areaName} · ` : ""}
        {cancelled
          ? "Cancelled by the host"
          : status === "approved"
            ? "You are going"
            : "Waiting on the host"}
      </p>
      <Link href={`/seshes/${sesh.id}`} className="text-sm font-semibold text-primary underline">
        Open
      </Link>
    </article>
  );
}
