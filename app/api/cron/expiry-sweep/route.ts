import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { floridaToday } from "@/lib/dates";
import { expiryMailerFromEnv, runExpirySweep } from "@/lib/member/expiry-sweep";
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

  return NextResponse.json({ ...sweep, addressesWiped: Number(wiped ?? 0) });
}
