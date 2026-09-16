import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Server-side client for server components, server actions and route
 *  handlers. Importing next/headers makes this module server-only.
 *
 *  A new client per render — never share one across requests, because the
 *  cookie store it closes over belongs to one request. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components cannot write cookies. The proxy refreshes the
            // session on every request, so a write that lands here is already
            // covered.
          }
        },
      },
    },
  );
}
