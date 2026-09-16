import Link from "next/link";
import { notFound } from "next/navigation";
import { amIAdmin, getSpend, listPending } from "@/lib/admin/queries";
import { serverEnv } from "@/lib/server-env";

export const metadata = { title: "Admin" };

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Spec §11 — spend: today's and this month's Claude cost, and how close today
 *  is to the daily ceiling. */
export default async function AdminHome() {
  if (!(await amIAdmin())) notFound();
  const [spend, pending] = await Promise.all([getSpend(), listPending()]);
  const ceiling = serverEnv().VISION_DAILY_CEILING;

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-3xl">Admin</h1>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card bg-surface p-4">
          <p className="text-sm text-ink-muted">Claude today</p>
          <p className="text-2xl">{usd(spend.todayUsd)}</p>
          <p className="text-sm text-ink-muted">{spend.todayCalls} of {ceiling} checks</p>
        </div>
        <div className="rounded-card bg-surface p-4">
          <p className="text-sm text-ink-muted">Claude this month</p>
          <p className="text-2xl">{usd(spend.monthUsd)}</p>
          <p className="text-sm text-ink-muted">{spend.monthCalls} checks</p>
        </div>
        <Link href="/admin/verifications" className="rounded-card bg-surface p-4">
          <p className="text-sm text-ink-muted">Waiting for review</p>
          <p className="text-2xl">{pending.length}</p>
        </Link>
      </section>
    </main>
  );
}
