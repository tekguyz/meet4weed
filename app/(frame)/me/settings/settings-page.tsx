import type { ReactNode } from "react";

/** The column every settings page sits in. The Frame's header already names
 *  the page and carries the back arrow, so this adds only the body. */
export function SettingsPage({ intro, children }: { intro?: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
      {intro ? <p className="text-sm text-ink-muted">{intro}</p> : null}
      {children}
    </div>
  );
}
