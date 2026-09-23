import { notFound, redirect } from "next/navigation";
import { ProfileView } from "@/components/member/profile-view";
import { getMyProfile, getProfileByHandle } from "@/lib/profiles/queries";

export const metadata = { title: "Profile" };

/**
 * A member's profile (issue #64). The profiles select policy decides who may
 * read it: the owner, a member who can browse, or an admin. Anybody else gets
 * no row, and no row is the same 404 as a handle that does not exist — the
 * page never says which, so it cannot be used to test whether a handle is
 * taken.
 */
export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  const me = await getMyProfile();
  if (!me) redirect("/login");

  // Not decoded: a real handle has nothing to decode, and anything with a `%`
  // in it fails the format check and is a 404 like any other.
  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      <ProfileView profile={profile} isMe={profile.id === me.id} />
    </div>
  );
}
