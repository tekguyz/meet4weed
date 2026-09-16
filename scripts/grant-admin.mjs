// Makes an existing account an admin (spec §11; decided 2026-09-16: an admins
// table, not a JWT claim). Uses the service key from .env.local.
//
//   npm run admin:grant -- someone@example.com
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin:grant -- <email>");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user;
for (let page = 1; !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (data.users.length < 1000) break;
}
if (!user) {
  console.error("No account has that email. Sign up first.");
  process.exit(1);
}

const { error } = await db.from("admins").upsert({ user_id: user.id });
if (error) throw error;
console.log("Done: that account is an admin.");
