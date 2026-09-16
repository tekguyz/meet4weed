import { NextResponse, type NextRequest } from "next/server";
import { floridaToday } from "@/lib/dates";
import { serverEnv } from "@/lib/server-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyChallengeToken } from "@/lib/verification/challenge-token";
import { IMAGE_LIMITS } from "@/lib/verification/jpeg";
import { limitsFromEnv } from "@/lib/verification/limits";
import { ownerAlertFromEnv } from "@/lib/verification/owner-alert";
import { createStore } from "@/lib/verification/store";
import { submitVerification } from "@/lib/verification/submit";
import { visionFromEnv } from "@/lib/verification/vision";

/** The one endpoint that can spend money. Every rule lives in
 *  submitVerification; this file only adapts HTTP to it. */
export const runtime = "nodejs";
export const maxDuration = 60;

async function bytesOf(value: FormDataEntryValue | null): Promise<Uint8Array | null> {
  if (!(value instanceof Blob)) return null;
  // Oversized uploads are refused by length without copying them.
  if (value.size > IMAGE_LIMITS.maxBytes) return new Uint8Array(IMAGE_LIMITS.maxBytes + 1);
  return new Uint8Array(await value.arrayBuffer());
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 });
  }

  const env = serverEnv();
  const outcome = await submitVerification(
    {
      memberId: user?.id ?? null,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
      patientId: form.get("patientId"),
      cardExpiresOn: form.get("cardExpiresOn"),
      challengeToken: form.get("challengeToken"),
      card: await bytesOf(form.get("card")),
      face: await bytesOf(form.get("face")),
    },
    {
      store: createStore(createAdminClient(), env.VERIFICATION_SECRET),
      limits: limitsFromEnv(),
      vision: visionFromEnv(),
      alertOwner: ownerAlertFromEnv(`${request.nextUrl.origin}/admin/verifications`),
      verifyChallenge: (token, memberId) => verifyChallengeToken(env.VERIFICATION_SECRET, token, memberId),
      today: () => floridaToday(),
    },
  );

  return NextResponse.json(outcome.body, { status: outcome.status });
}
