import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_EMAIL_FROM, resendFromEnv } from "@/lib/email";

/**
 * Spec §4.3: flip expired cards to read-only, and send exactly one email.
 * expiry_sweep() does the flip and lists who is owed the email; a notice row
 * is written only after the send succeeds, and its primary key makes a second
 * email for the same expiry date impossible.
 */

const LONG_DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function expiryEmail(cardExpiresOn: string, today: string, renewUrl: string): { subject: string; text: string } {
  const onTheDay = cardExpiresOn === today;
  const date = LONG_DATE.format(new Date(`${cardExpiresOn}T00:00:00Z`));
  return {
    subject: onTheDay ? "Your Meet4Weed card expires today" : "Your Meet4Weed card has expired",
    text: [
      onTheDay ? `The OMMU card on your Meet4Weed account expires today, ${date}.` : `The OMMU card on your Meet4Weed account expired on ${date}.`,
      "",
      "After it expires your account is read-only. You can still browse and see your history, but you cannot RSVP, host, see an address, or send messages.",
      "",
      `Add your renewed card here and full access comes back as soon as a person checks it: ${renewUrl}`,
      "",
      "This is the only email we send about it.",
    ].join("\n"),
  };
}

export async function runExpirySweep(
  db: SupabaseClient,
  today: string,
  send: (to: string, cardExpiresOn: string) => Promise<void>,
): Promise<{ notified: number; failed: number }> {
  const { data, error } = await db.rpc("expiry_sweep", { p_today: today });
  if (error) throw new Error(`expiry_sweep failed: ${error.code}`);

  let notified = 0;
  let failed = 0;
  for (const row of (data ?? []) as { member_id: string; email: string; card_expires_on: string }[]) {
    try {
      await send(row.email, row.card_expires_on);
    } catch (sendError) {
      failed += 1;
      console.error(`[expiry-sweep] email failed: ${(sendError as Error).message}`);
      continue;
    }
    const { error: noticeError } = await db
      .from("expiry_notices")
      .insert({ member_id: row.member_id, card_expires_on: row.card_expires_on });
    if (noticeError && noticeError.code !== "23505") console.error(`[expiry-sweep] notice not recorded: ${noticeError.code}`);
    notified += 1;
  }
  return { notified, failed };
}

export function expiryMailerFromEnv(renewUrl: string, today: string) {
  const resend = resendFromEnv();
  return async (to: string, cardExpiresOn: string) => {
    const { subject, text } = expiryEmail(cardExpiresOn, today, renewUrl);
    const { error } = await resend.emails.send({ from: APP_EMAIL_FROM, to, subject, text });
    if (error) throw new Error("Resend did not accept the expiry email");
  };
}
