import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FeedList } from "@/components/notify/feed-list";
import { MarkSeen } from "@/components/notify/mark-seen";
import { floridaToday } from "@/lib/dates";
import { canBrowse, memberAccess } from "@/lib/member/gate";
import { listMyFeed } from "@/lib/notify/queries";
import { getMyProfile } from "@/lib/profiles/queries";

export const metadata: Metadata = { title: "Notifications" };

/**
 * The feed (issue #52). An expired member reads it too: read-only means
 * read-only, not shut out. The gate is can_browse — the same one that shows
 * the bell — not is_active_member.
 */
export default async function NotificationsPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");
  if (!canBrowse(memberAccess(profile, floridaToday()))) redirect("/");

  const items = await listMyFeed();
  const unread = items.filter((item) => item.readAt === null).map((item) => item.id);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl">Notifications</h1>
      <FeedList items={items} />
      <MarkSeen ids={unread} />
    </div>
  );
}
