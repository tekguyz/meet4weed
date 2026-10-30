// Runs the Supabase CLI with this project's own access token, so it works
// from any terminal: the Run button (PowerShell) and Git Bash alike.
//
//   npm run db:push                     push new migrations
//   npm run supabase -- migration list  any other CLI command
//
// The token is SUPABASE_ACCESS_TOKEN under "env" in .claude/settings.local.json
// (not in git). Claude Code reads that file; a plain terminal does not, so
// without this the CLI falls back to the saved login, which belongs to another
// Supabase account and gets "401 Unauthorized".
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const file = path.resolve(import.meta.dirname, "../.claude/settings.local.json");
let token = "";
try {
  token = JSON.parse(readFileSync(file, "utf8"))?.env?.SUPABASE_ACCESS_TOKEN ?? "";
} catch {
  // Handled below.
}
if (!token) {
  console.error(`No SUPABASE_ACCESS_TOKEN under "env" in ${file}. Add this project's token there.`);
  process.exit(1);
}

const result = spawnSync("supabase", process.argv.slice(2), {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
});
process.exit(result.status ?? 1);
