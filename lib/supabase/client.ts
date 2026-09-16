import { createBrowserClient } from "@supabase/ssr";

/** Browser-side client. Publishable key only — never the secret key, which
 *  bypasses RLS and would be shipped to every visitor by NEXT_PUBLIC_. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
