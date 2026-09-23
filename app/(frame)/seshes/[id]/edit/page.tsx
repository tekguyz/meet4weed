import { notFound, redirect } from "next/navigation";
import { editSesh } from "@/app/(frame)/seshes/actions";
import { CancelSesh } from "@/components/sesh/cancel-sesh";
import { SeshForm } from "@/components/sesh/sesh-form";
import { Banner } from "@/components/ui/banner";
import { floridaWallClock } from "@/lib/dates";
import { getMyProfile } from "@/lib/profiles/queries";
import { getMySesh, getSeshAddress } from "@/lib/sesh/queries";

export default async function EditSeshPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  const sesh = await getMySesh(id);
  if (!sesh || sesh.hostId !== profile.id) notFound();

  // The host branch of the unlock has no time check and no cancelled check,
  // so this loads even for a sesh that has already run. It returns null once
  // the 7-day wipe has taken the address.
  const address = await getSeshAddress(id);

  const cancelled = sesh.status === "cancelled";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">{cancelled ? "Cancelled sesh" : "Edit your sesh"}</h1>
        {cancelled ? (
          <p className="text-sm text-ink-muted">
            This one is cancelled, and cancelling is final. Your guests can still see it marked
            cancelled, and the address is already locked.
          </p>
        ) : null}
        {!address ? (
          <Banner>
            The address for this sesh is no longer stored. It is deleted seven days after a sesh.
          </Banner>
        ) : null}
      </header>

      {cancelled ? null : (
        <SeshForm
          action={editSesh}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          defaults={{
            id: sesh.id,
            title: sesh.title,
            description: sesh.description,
            seshType: sesh.seshType,
            visibility: sesh.visibility,
            startsAtLocal: floridaWallClock(new Date(sesh.startsAt)),
            capacity: sesh.capacity,
            areaName: sesh.areaName,
            addressLine: address?.addressLine ?? "",
            unitNote: address?.unitNote ?? "",
            gateCode: address?.gateCode ?? "",
            point:
              address?.exactLat != null && address?.exactLng != null
                ? { lat: address.exactLat, lng: address.exactLng }
                : null,
          }}
        />
      )}

      {cancelled ? null : <CancelSesh id={sesh.id} />}
    </div>
  );
}
