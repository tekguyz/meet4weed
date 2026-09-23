import Link from "next/link";
import { redirect } from "next/navigation";
import { SeshForm } from "@/components/sesh/sesh-form";
import { createSesh } from "@/app/(frame)/seshes/actions";
import { getMyProfile } from "@/lib/profiles/queries";
import { floridaToday } from "@/lib/dates";
import { memberAccess } from "@/lib/member/gate";

export default async function NewSeshPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  // The database refuses this too — the insert policy calls
  // private.is_active_member. This is so a member reads a sentence instead of
  // filling in a long form and being told no at the end.
  const access = memberAccess(profile, floridaToday());
  if (access !== "full") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
        <h1 className="text-3xl">Not yet</h1>
        <p className="text-sm text-ink-muted">
          {access === "read_only"
            ? "Your card has expired, so you cannot host until you renew it."
            : "You can host once a person has checked your card."}
        </p>
        {access === "read_only" ? (
          <Link href="/verify" className="text-sm font-semibold text-primary underline">
            Add your renewed card
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Host a sesh</h1>
        <p className="text-sm text-ink-muted">
          You decide who comes. Nobody gets your address until you say yes to them.
        </p>
      </header>

      <SeshForm action={createSesh} submitLabel="Post the sesh" pendingLabel="Posting…" />
    </div>
  );
}
