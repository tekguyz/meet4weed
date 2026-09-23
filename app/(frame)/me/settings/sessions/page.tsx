import { SignOutEverywhere } from "@/components/member/sign-out-everywhere";
import { Button } from "@/components/ui/button";
import { SettingsPage } from "../settings-page";

export const metadata = { title: "Sessions" };

export default function SessionsPage() {
  return (
    <SettingsPage>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">This device</h2>
        {/* A POST, like the one on Me: a GET sign-out can be fired by an <img>. */}
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="quiet">
            Sign out
          </Button>
        </form>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Every device</h2>
        <p className="text-sm text-ink-muted">
          Lost a phone? This signs you out everywhere, this device included.
        </p>
        <SignOutEverywhere />
      </section>
    </SettingsPage>
  );
}
