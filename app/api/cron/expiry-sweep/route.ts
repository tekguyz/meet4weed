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
  const send = expiryMailerFromEnv(`${request.nextUrl.origin}/verify`, today);
  return NextResponse.json(await runExpirySweep(createAdminClient(), today, send));
}
