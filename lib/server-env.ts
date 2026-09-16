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
  // Root of the image-encryption and challenge-signing keys (lib/verification/keys.ts).
  VERIFICATION_SECRET: z.string().refine((v) => Buffer.from(v, "base64").length >= 32),
  // Vercel Cron sends it as a bearer token.
  CRON_SECRET: z.string().min(32),
  OWNER_ALERT_EMAIL: z.email(),
  VISION_DAILY_CEILING: z.coerce.number().int().min(0).default(50),
  VERIFY_MEMBER_DAILY_LIMIT: z.coerce.number().int().min(1).default(3),
  VERIFY_IP_DAILY_LIMIT: z.coerce.number().int().min(1).default(10),
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
