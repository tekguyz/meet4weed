import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { floridaToday } from "@/lib/dates";
import { reapDemoVisitors, shiftDemoCast } from "@/lib/demo/nightly";
import { expiryMailerFromEnv, runExpirySweep } from "@/lib/member/expiry-sweep";
import { reapOldNotifications, runClockNotices } from "@/lib/notify/clock";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }
  const today = floridaToday();
  const db = createAdminClient();
  const send = expiryMailerFromEnv(`${request.nextUrl.origin}/verify`, today);

  const sweep = await runExpirySweep(db, today, send);

  // The whole 7-day forget, in one call: the address, the bring list, the
  // invites and the invite claims (#32). Rides here rather than taking a
  // third cron job — vercel.json already registers two and the plan does not
  // allow another. expiry_sweep() itself is untouched; it has been running
  // against real members since Plan 02.
  //
  // The count is seshes whose ADDRESS was wiped, unchanged since #10. The
  // deletes are idempotent and report nothing, so a run that only clears
  // history still says 0.
  const { data: wiped, error } = await db.rpc("sesh_address_reaper");
  if (error) throw new Error(`sesh_address_reaper failed: ${error.code}`);

  // The two clock-driven notification types and the 90-day reaper (#55).
  // They ride here for the same reason: vercel.json already registers two
  // jobs, and the route is not renamed, because a rename touches vercel.json
  // and scripts/run-cron.mjs for no change in behaviour.
  // lib/notify/clock.ts says what "a 24-hour reminder" means on a daily job.
  //
  // After the sweep, so a card flipped to expired today is off the ladder.
  const now = new Date();
  const notices = await runClockNotices(db, now);
  const notificationsReaped = await reapOldNotifications(db, now);

  // The demo realm (#39): the cast's dates move to their offsets from today,
  // in place, and every visitor older than seven days is deleted. Here for
  // the same reason as everything above: no new cron route, no new secret.
  // The reap runs last, so a notice written above for a leaving visitor
  // goes with them.
  const castMoved = await shiftDemoCast(db);
  const visitorsDeleted = await reapDemoVisitors(db);

  return NextResponse.json({
    ...sweep,
    addressesWiped: Number(wiped ?? 0),
    ...notices,
    notificationsReaped,
    castMoved,
    visitorsDeleted,
  });
}
