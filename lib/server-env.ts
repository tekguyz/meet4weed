import "server-only";
import { z } from "zod";

/**
 * Every server-only setting, validated once. The only file that reads these
 * names from the environment — lib/__tests__/secret-boundary.test.ts holds
 * that line.
 *
 * An error names what is missing and never prints a value.
 */
const Schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  // Root of the image-encryption and challenge-signing keys (lib/derived-keys.ts).
  VERIFICATION_SECRET: z.string().refine((v) => Buffer.from(v, "base64").length >= 32),
  // Vercel Cron sends it as a bearer token.
  CRON_SECRET: z.string().min(32),
  OWNER_ALERT_EMAIL: z.email(),
  VISION_DAILY_CEILING: z.coerce.number().int().min(0).default(50),
  VERIFY_MEMBER_DAILY_LIMIT: z.coerce.number().int().min(1).default(3),
  VERIFY_IP_DAILY_LIMIT: z.coerce.number().int().min(1).default(10),
  // Web push (#56). Optional: without both, push is off and the feed still
  // works. The public half also reaches the browser; the private half never.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  // Set by Vercel at build. Not a secret: it names the build on Me's About line.
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  // Development only: the dev account's password for /api/dev-login. Written
  // into .env.local by the route itself when missing.
  DEV_LOGIN_PASSWORD: z.string().optional(),
  // The demo door (#39). Off unless "true", in any case. Not a secret, but read
  // here like every other server setting, and never NEXT_PUBLIC_.
  DEMO_MODE_ENABLED: z.string().optional(),
});

export type ServerEnv = z.infer<typeof Schema>;

let cached: ServerEnv | undefined;

export function serverEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const fromProcess = source === process.env;
  if (fromProcess && cached) return cached;

  const parsed = Schema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Server environment is missing or invalid: ${names.join(", ")}`);
  }
  if (fromProcess) cached = parsed.data;
  return parsed.data;
}

/** Whether the demo door is open (#39). Reads the one flag without
 *  validating the rest, so the landing page and /login can ask it during a
 *  build that holds no secrets. "true" in any case is on, so `TRUE` typed in
 *  the Vercel dashboard works; anything else is off. */
export function demoModeEnabled(source: Record<string, string | undefined> = process.env): boolean {
  return source.DEMO_MODE_ENABLED?.trim().toLowerCase() === "true";
}
