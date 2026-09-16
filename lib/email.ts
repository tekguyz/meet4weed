import "server-only";
import { Resend } from "resend";
import { serverEnv } from "@/lib/server-env";

/** App-sent email (spec §2): the owner's review alert and the single expiry
 *  notice. Auth email is sent by Supabase over Resend SMTP instead. */
export const APP_EMAIL_FROM = "Meet4Weed <no-reply@tekguyz.com>";

export type EmailSender = {
  emails: {
    send(message: { from: string; to: string; subject: string; text: string }): Promise<{ error: unknown }>;
  };
};

export function resendFromEnv(): Resend {
  return new Resend(serverEnv().RESEND_API_KEY);
}
