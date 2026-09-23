import { notFound } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { amIAdmin, getSubmission } from "@/lib/admin/queries";
import { DecisionForm } from "./decision-form";

export const metadata = { title: "Review a card" };

const yesNo = (v: boolean | undefined) => (v === undefined ? "—" : v ? "yes" : "no");

/** Spec §4.1 step 9: both photos side by side, the challenge, the typed fields
 *  next to what Claude read, and Claude's concerns. The reviewer compares the
 *  face to the photo on the card by eye. */
export default async function Review({ params }: { params: Promise<{ id: string }> }) {
  if (!(await amIAdmin())) notFound();
  const { id } = await params;
  const s = await getSubmission(id);
  if (!s) notFound();

  const r = s.reading;
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-3xl">@{s.handle}</h1>
      <p className="text-sm text-ink-muted">Submitted {new Date(s.createdAt).toLocaleString("en-US", { timeZone: "America/New_York" })} · {s.status}</p>

      <section className="grid gap-4 md:grid-cols-2">
        {(["card", "face_with_card"] as const).map((kind) =>
          s.documentKinds.includes(kind) ? (
            // A plain <img>: the image is decrypted per request, and next/image would cache it.
            <img key={kind} src={`/admin/verifications/${s.id}/image/${kind}`} alt={kind === "card" ? "Card close-up" : "Member holding the card"} className="w-full rounded-card" />
          ) : (
            <p key={kind} className="rounded-card bg-surface p-4 text-sm text-ink-muted">Photo already deleted.</p>
          ),
        )}
      </section>

      <section className="rounded-card bg-surface p-4">
        <p className="text-sm text-ink-muted">Requested pose</p>
        <p className="text-lg text-primary">{s.challenge}</p>
      </section>

      {s.skippedReason ? (
        <Banner tone="warning">
          Claude did not read this card ({s.skippedReason === "daily_ceiling" ? "the daily ceiling was reached" : "the rate limiter was unavailable"}). Read it yourself.
        </Banner>
      ) : null}
      {s.visionError ? (
        <Banner tone="warning">Claude's read failed ({s.visionError}). Read the card yourself.</Banner>
      ) : null}

      <table className="w-full text-left text-sm">
        <thead className="text-ink-muted">
          <tr><th className="py-2">Field</th><th>Member typed</th><th>Claude read</th></tr>
        </thead>
        <tbody>
          <tr><td className="py-2">Patient ID</td><td>{s.patientId}</td><td>{r?.patientId ?? "—"}</td></tr>
          <tr><td className="py-2">Expiry</td><td>{s.typedCardExpiresOn}</td><td>{r?.expiryDate ?? "—"}</td></tr>
          <tr><td className="py-2">Name on card</td><td>—</td><td>{r?.nameOnCard ?? "—"}</td></tr>
          <tr><td className="py-2">Legible</td><td /><td>{yesNo(r?.fieldsLegible)}</td></tr>
          <tr><td className="py-2">Typed fields match</td><td /><td>{yesNo(r?.typedFieldsMatch)}</td></tr>
          <tr><td className="py-2">Card in face photo</td><td /><td>{yesNo(r?.cardVisibleInFacePhoto)}</td></tr>
          <tr><td className="py-2">Pose performed</td><td /><td>{yesNo(r?.challengeAppearsPerformed)}</td></tr>
        </tbody>
      </table>

      <section>
        <h2 className="text-xl">Claude's concerns</h2>
        {s.concerns.length ? (
          <ul className="list-disc pl-6 text-sm">{s.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
        ) : (
          <p className="text-sm text-ink-muted">None listed. That is not an approval.</p>
        )}
      </section>

      {s.status === "pending_review" ? <DecisionForm id={s.id} typedExpiry={s.typedCardExpiresOn} /> : null}
    </main>
  );
}
