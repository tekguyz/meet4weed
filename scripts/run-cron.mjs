// Runs a cron route by hand against the local dev server, with the secret from
// .env.local, without printing it.
//
//   npm run cron:run -- verification-reaper
//   npm run cron:run -- expiry-sweep
const job = process.argv[2];
if (!["verification-reaper", "expiry-sweep"].includes(job)) {
  console.error("Usage: npm run cron:run -- verification-reaper|expiry-sweep");
  process.exit(1);
}
const base = process.env.CRON_BASE_URL ?? "http://localhost:3000";
const response = await fetch(`${base}/api/cron/${job}`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
console.log(response.status, await response.text());
