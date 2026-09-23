import "server-only";
import pkg from "@/package.json";
import { serverEnv } from "@/lib/server-env";

/** The About line on Me (issue #65): one string a member can quote when they
 *  report a problem. package.json alone never changes between deploys, so the
 *  build's commit is added when Vercel supplies it. */
export function formatVersion(version: string, commitSha: string | undefined): string {
  return commitSha ? `${version} (${commitSha.slice(0, 7)})` : version;
}

export function appVersion(): string {
  return formatVersion(pkg.version, serverEnv().VERCEL_GIT_COMMIT_SHA);
}
