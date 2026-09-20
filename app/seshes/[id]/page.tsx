import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddressPanel } from "@/components/sesh/address-panel";
import { ChangedBanner } from "@/components/sesh/changed-banner";
import { AskToJoin, DecideButtons, WithdrawRsvp } from "@/components/sesh/rsvp-buttons";
import { floridaToday } from "@/lib/dates";
import { memberAccess } from "@/lib/member/gate";
import { getMyProfile } from "@/lib/profiles/queries";
import { getSesh, getSeshAddress, listRsvps, type RsvpRow, type SeshListItem } from "@/lib/sesh/queries";
import { SESH_TYPE_LABELS } from "@/lib/sesh/schema";

const WHEN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function SeshPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const sesh = await getSesh(id);
  if (!sesh) notFound();

  const rsvps = await listRsvps(id);
  // Returns null when the caller may not read it. The screen renders that;
  // it never works out who is allowed. See private.can_see_address.
  const address = await getSeshAddress(id);
  const iAmHost = sesh.hostId === profile.id;
  const mine = rsvps.find((r) => r.memberId === profile.id) ?? null;
  const approved = rsvps.filter((r) => r.status === "approved");
  const waiting = rsvps.filter((r) => r.status === "requested");
  const left = Math.max(sesh.capacity - sesh.approvedCount, 0);
  const canAct = memberAccess(profile, floridaToday()) === "full";
  const over = new Date(sesh.startsAt).getTime() <= Date.now();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        {sesh.status === "cancelled" ? (
          <p role="status" className="rounded-card bg-surface p-4 text-sm text-danger">
            This sesh was cancelled. Do not turn up.
          </p>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-3xl">{sesh.title}</h1>
          <span className="shrink-0 rounded-control bg-surface-2 px-2 py-1 text-xs text-ink-muted">
            {SESH_TYPE_LABELS[sesh.seshType]}
          </span>
        </div>
        <p className="text-sm text-ink-muted">{WHEN.format(new Date(sesh.startsAt))} ET</p>
        <p className="text-sm text-ink-muted">
          {sesh.areaName ? `${sesh.areaName} · ` : ""}
          {left === 0 ? "full" : `${left} spot${left === 1 ? "" : "s"} left`}
        </p>
      </header>

      {sesh.description ? <p className="text-sm text-ink">{sesh.description}</p> : null}

      <AddressPanel address={address} areaName={sesh.areaName} />

      {iAmHost ? (
        <HostQueue seshId={sesh.id} waiting={waiting} approved={approved} />
      ) : (
        <GuestActions
          sesh={sesh}
          mine={mine}
          approved={approved}
          canAct={canAct && !over && sesh.status === "open"}
        />
      )}

      <Link href="/seshes" className="text-sm text-ink-muted underline">
        Back to seshes
      </Link>
    </main>
  );
}

function Person({ rsvp }: { rsvp: RsvpRow }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-ink">@{rsvp.handle}</span>
      {rsvp.bio ? <span className="line-clamp-2 text-sm text-ink-muted">{rsvp.bio}</span> : null}
    </div>
  );
}

function HostQueue({
  seshId,
  waiting,
  approved,
}: {
  seshId: string;
  waiting: RsvpRow[];
  approved: RsvpRow[];
}) {
  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">
          Waiting on you{waiting.length ? ` (${waiting.length})` : ""}
        </h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-ink-muted">Nobody is waiting.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {waiting.map((rsvp) => (
              <li key={rsvp.id} className="flex flex-col gap-2 rounded-card bg-surface p-4">
                <Person rsvp={rsvp} />
                <DecideButtons rsvpId={rsvp.id} seshId={seshId} approved={false} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Coming ({approved.length})</h2>
        {approved.length === 0 ? (
          <p className="text-sm text-ink-muted">Nobody yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {approved.map((rsvp) => (
              <li key={rsvp.id} className="flex flex-col gap-2 rounded-card bg-surface p-4">
                <Person rsvp={rsvp} />
                <DecideButtons rsvpId={rsvp.id} seshId={seshId} approved />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function GuestActions({
  sesh,
  mine,
  approved,
  canAct,
}: {
  sesh: SeshListItem;
  mine: RsvpRow | null;
  approved: RsvpRow[];
  canAct: boolean;
}) {
  const left = Math.max(sesh.capacity - sesh.approvedCount, 0);

  return (
    <section className="flex flex-col gap-4">
      {mine?.status === "approved" ? (
        <>
          <p role="status" className="rounded-card bg-surface p-4 text-sm text-ink">
            You are going.
          </p>
          {/* Only an approved guest gets this: nobody else was told a time or
              a place to have it changed out from under them. */}
          <ChangedBanner changedAt={sesh.materiallyChangedAt} startsAt={sesh.startsAt} />
          <WithdrawRsvp seshId={sesh.id} approved />
          <div className="flex flex-col gap-2">
            <h2 className="text-lg">Who else is coming ({approved.length})</h2>
            <ul className="flex flex-col gap-2">
              {approved.map((rsvp) => (
                <li key={rsvp.id}>
                  <Person rsvp={rsvp} />
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : mine?.status === "requested" ? (
        <>
          <p role="status" className="rounded-card bg-surface p-4 text-sm text-ink">
            You have asked to come. The host has not decided yet.
          </p>
          <WithdrawRsvp seshId={sesh.id} approved={false} />
        </>
      ) : mine?.status === "kicked" ? (
        <p role="status" className="rounded-card bg-surface p-4 text-sm text-ink-muted">
          The host removed you from this sesh.
        </p>
      ) : !canAct ? (
        <p className="text-sm text-ink-muted">
          {sesh.status === "cancelled"
            ? "This sesh is cancelled."
            : "You cannot ask to join this one. Check your card is current."}
        </p>
      ) : left === 0 ? (
        <p className="text-sm text-ink-muted">This one is full.</p>
      ) : (
        <AskToJoin seshId={sesh.id} />
      )}
    </section>
  );
}
