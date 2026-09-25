import Link from "next/link";
import { notFound } from "next/navigation";
import { amIAdmin } from "@/lib/admin/queries";
import { TAP_TEXT } from "@/components/ui/focus";

/** A 404, not a "forbidden": the admin area does not announce itself. Each page
 *  and the image route check again, because a layout does not re-run on every
 *  navigation. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await amIAdmin())) notFound();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <nav className="flex flex-wrap gap-x-4 text-sm text-ink-muted">
        <Link href="/admin" className={`${TAP_TEXT} underline`}>Admin</Link>
        <Link href="/admin/verifications" className={`${TAP_TEXT} underline`}>Verification queue</Link>
        <Link href="/" className={`${TAP_TEXT} underline`}>Back to app</Link>
      </nav>
      {children}
    </div>
  );
}
