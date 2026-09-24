import type { ReactNode } from "react";

/**
 * The shape of Help, Terms, Privacy and Community rules (issue #68). The owner
 * writes the copy; until then each section holds a <Placeholder>.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-8">
      <h1 className="text-3xl">{title}</h1>
      {children}
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl">{title}</h2>
      {children}
    </section>
  );
}

/** Copy nobody has written yet. It says so on the page, in words, so that
 *  placeholder text is never read as the real terms. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-dashed border-rule p-4 text-sm text-ink-muted">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink">
        Placeholder — the owner writes this
      </p>
      {children}
    </div>
  );
}
