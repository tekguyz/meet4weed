import { expiryBanner, memberAccess } from "@/lib/member/gate";
import type { MemberStatus } from "@/lib/profiles/schema";

/**
 * Where a member stands with their card — the one state the where-you-stand
 * card renders. Rejected and retake are not member statuses: a decision puts
 * the profile back where it was, so they come from the latest submission.
 */
export type Standing =
  | { kind: "verified"; expiresOn: string }
  | { kind: "expiring"; notice: string }
  | { kind: "expired" }
  | { kind: "pending" }
  | { kind: "rejected"; reason: string | null }
  | { kind: "retake"; reason: string | null }
  | { kind: "lapsed" }
  | { kind: "unverified" }
  | { kind: "suspended" };

type Card = { status: MemberStatus; cardExpiresOn: string | null };
type Latest = { status: string; decisionReason: string | null } | null;

export function standing(profile: Card, latest: Latest, today: string): Standing {
  const access = memberAccess(profile, today);
  if (access === "suspended") return { kind: "suspended" };
  if (access === "pending" || latest?.status === "pending_review") return { kind: "pending" };

  if (access === "full") {
    const notice = expiryBanner(profile, today);
    return notice ? { kind: "expiring", notice } : { kind: "verified", expiresOn: profile.cardExpiresOn! };
  }

  // Unverified, or expired with a renewal that did not go through.
  if (latest?.status === "rejected") return { kind: "rejected", reason: latest.decisionReason };
  if (latest?.status === "retake_requested") return { kind: "retake", reason: latest.decisionReason };
  if (latest?.status === "lapsed") return { kind: "lapsed" };
  return access === "read_only" ? { kind: "expired" } : { kind: "unverified" };
}
