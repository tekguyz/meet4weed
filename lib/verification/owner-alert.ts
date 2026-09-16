import "server-only";
import { APP_EMAIL_FROM, resendFromEnv, type EmailSender } from "@/lib/email";
import { serverEnv } from "@/lib/server-env";

/** A link, never the card. Spec §11: mailing a photo or its details would put
 *  them in an inbox permanently and break the retention promise in §4.2. */
export async function sendOwnerAlert(sender: EmailSender, to: string, reviewUrl: string): Promise<void> {
  const { error } = await sender.emails.send({
    from: APP_EMAIL_FROM,
    to,
    subject: "A Meet4Weed card is waiting for review",
    text: [
      "A member submitted their card for review.",
      "",
      `Review it here: ${reviewUrl}`,
      "",
      "This email holds no photos and no card details on purpose. They stay in the app and are deleted when you decide.",
    ].join("\n"),
  });
  if (error) throw new Error("Resend did not accept the owner alert");
}

export function ownerAlertFromEnv(reviewUrl: string): () => Promise<void> {
  const env = serverEnv();
  const resend = resendFromEnv();
  return () => sendOwnerAlert(resend, env.OWNER_ALERT_EMAIL, reviewUrl);
}
