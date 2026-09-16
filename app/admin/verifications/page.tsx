import Link from "next/link";
import { notFound } from "next/navigation";
import { amIAdmin, listPending } from "@/lib/admin/queries";

export const metadata = { title: "Verification queue" };

function age(iso: string): string {
  const hours = Math.floor((Date.now() - Date.parse(iso)) / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} days`;
}

export default async function Queue() {
  if (!(await amIAdmin())) notFound();
  const pending = await listPending();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-3xl">Verification queue</h1>
      <p className="text-sm text-ink-muted">Oldest first. Photos are deleted after 7 days whether or not they were reviewed.</p>
      {pending.length === 0 ? <p className="text-sm text-ink-muted">Nothing is waiting.</p> : null}
      <ul className="flex flex-col gap-2">
        {pending.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/verifications/${p.id}`} className="flex justify-between rounded-card bg-surface p-4">
              <span>@{p.handle}</span>
              <span className="text-sm text-ink-muted">
                {age(p.createdAt)}
                {p.skippedReason ? " · not read by Claude" : ""}
                {p.visionError ? " · Claude failed" : ""}
                {p.concernCount ? ` · ${p.concernCount} concern${p.concernCount === 1 ? "" : "s"}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
