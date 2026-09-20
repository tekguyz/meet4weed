// Runs a cron route by hand against the local dev server, with the secret from
// .env.local, without printing it.
//
//   npm run cron:run -- verification-reaper
//   npm run cron:run -- expiry-sweep
//
// Add --https while the HTTPS dev-phone server is the one running. That flag
// talks to https://localhost:3000 and trusts the one self-signed certificate in
// private/dev-cert/cert.pem for this request only. It never sets
// NODE_TLS_REJECT_UNAUTHORIZED, so no other process loses certificate checks.
import { readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";

const args = process.argv.slice(2);
const https = args.includes("--https");
const job = args.find((arg) => !arg.startsWith("--"));
if (!["verification-reaper", "expiry-sweep"].includes(job)) {
  console.error("Usage: npm run cron:run -- verification-reaper|expiry-sweep [--https]");
  process.exit(1);
}

const DEV_CERT = "private/dev-cert/cert.pem";
const headers = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

if (!https) {
  const base = process.env.CRON_BASE_URL ?? "http://localhost:3000";
  const response = await fetch(`${base}/api/cron/${job}`, { headers });
  console.log(response.status, await response.text());
} else {
  let ca;
  try {
    ca = readFileSync(DEV_CERT);
  } catch {
    console.error(`--https needs the dev certificate at ${DEV_CERT}. See README → Testing the camera on a phone.`);
    process.exit(1);
  }
  const { status, body } = await new Promise((resolve, reject) => {
    const req = httpsRequest(
      { host: "localhost", port: 3000, path: `/api/cron/${job}`, method: "GET", headers, ca },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
  console.log(status, body);
}
