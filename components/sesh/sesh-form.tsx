"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LocationPicker } from "@/components/sesh/location-picker";
import {
  SESH_TYPE_OPTIONS,
  SESH_VISIBILITY_OPTIONS,
  type SeshType,
  type SeshVisibility,
} from "@/lib/sesh/schema";
import type { ActionState } from "@/lib/forms/action-state";

export type SeshFormDefaults = {
  id?: string;
  title?: string;
  description?: string | null;
  seshType?: SeshType;
  visibility?: SeshVisibility;
  startsAtLocal?: string;
  capacity?: number;
  areaName?: string | null;
  addressLine?: string | null;
  unitNote?: string | null;
  gateCode?: string | null;
  point?: { lat: number; lng: number } | null;
};

type Props = {
  action: (state: ActionState | null, formData: FormData) => Promise<ActionState>;
  defaults?: SeshFormDefaults;
  submitLabel: string;
  pendingLabel: string;
};

function FieldError({ state, name }: { state: ActionState | null; name: string }) {
  const message = state?.fieldErrors?.[name];
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

export function SeshForm({ action, defaults = {}, submitLabel, pendingLabel }: Props) {
  const [state, submit, pending] = useActionState<ActionState | null, FormData>(action, null);

  return (
    <form action={submit} className="flex flex-col gap-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} readOnly /> : null}

      <div className="flex flex-col gap-1.5">
        <Input
          label="What is it?"
          name="title"
          required
          maxLength={80}
          placeholder="Friday wind-down"
          defaultValue={defaults.title ?? ""}
        />
        <FieldError state={state} name="title" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea
          label="Anything they should know?"
          name="description"
          maxLength={1000}
          defaultValue={defaults.description ?? ""}
        />
        <FieldError state={state} name="description" />
      </div>

      <Select
        label="Type"
        name="seshType"
        options={SESH_TYPE_OPTIONS}
        defaultValue={defaults.seshType ?? "chill"}
      />

      <div className="flex flex-col gap-1.5">
        <Select
          label="Who can find it?"
          name="visibility"
          options={SESH_VISIBILITY_OPTIONS}
          defaultValue={defaults.visibility ?? "listed"}
        />
        <p className="text-sm text-ink-muted">
          Unlisted keeps it out of the feed, the map and search. Anyone already coming still sees
          it, and you can change your mind later without dropping them.
        </p>
        <FieldError state={state} name="visibility" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Input
          label="Starts (Florida time)"
          name="startsAtLocal"
          type="datetime-local"
          required
          defaultValue={defaults.startsAtLocal ?? ""}
        />
        <FieldError state={state} name="startsAtLocal" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Input
          label="How many guests?"
          name="capacity"
          type="number"
          min={1}
          max={50}
          required
          defaultValue={defaults.capacity ?? 6}
        />
        <p className="text-sm text-ink-muted">You are not one of the spots.</p>
        <FieldError state={state} name="capacity" />
      </div>

      <fieldset className="flex flex-col gap-4 rounded-card bg-surface p-4">
        <legend className="px-1 text-sm font-medium text-ink-muted">Where</legend>

        <LocationPicker defaultPoint={defaults.point ?? null} fieldError={state?.fieldErrors?.exactLat} />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Street address"
            name="addressLine"
            required
            maxLength={200}
            defaultValue={defaults.addressLine ?? ""}
          />
          <p className="text-sm text-ink-muted">Only approved guests ever read this.</p>
          <FieldError state={state} name="addressLine" />
        </div>

        <Input label="Unit or buzzer (optional)" name="unitNote" maxLength={60} defaultValue={defaults.unitNote ?? ""} />
        <Input label="Gate code (optional)" name="gateCode" maxLength={40} defaultValue={defaults.gateCode ?? ""} />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Area name (optional)"
            name="areaName"
            maxLength={40}
            placeholder="Filled in for you"
            defaultValue={defaults.areaName ?? ""}
          />
          <p className="text-sm text-ink-muted">
            A neighbourhood, not a street — this one is public. Leave it blank and we will work it
            out from the circle, never from your address.
          </p>
          <FieldError state={state} name="areaName" />
        </div>
      </fieldset>

      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
