import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateSeshForm } from "@/components/sesh/create-form";
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
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl">Not yet</h1>
        <p className="text-sm text-ink-muted">
          {access === "read_only"
            ? "Your card has expired, so you cannot host until you renew it."
            : "You can host once a person has checked your card."}
        </p>
        <Link href={access === "read_only" ? "/verify" : "/"} className="text-sm font-semibold text-primary underline">
          {access === "read_only" ? "Add your renewed card" : "Back"}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Host a sesh</h1>
        <p className="text-sm text-ink-muted">
          You decide who comes. Nobody gets your address until you say yes to them.
        </p>
      </header>

      <CreateSeshForm />
    </main>
  );
}
