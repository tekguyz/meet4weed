"use client";

import { useActionState } from "react";
import { createSesh } from "@/app/seshes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SESH_TYPE_OPTIONS } from "@/lib/sesh/schema";
import type { ActionState } from "@/lib/forms/action-state";

function FieldError({ state, name }: { state: ActionState | null; name: string }) {
  const message = state?.fieldErrors?.[name];
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

/** Ticket #4 takes the pin as two typed numbers. The map picker replaces them
 *  in #5 — the columns and the action do not change when it does. */
export function CreateSeshForm() {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(createSesh, null);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Input label="What is it?" name="title" required maxLength={80} placeholder="Friday wind-down" />
        <FieldError state={state} name="title" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea label="Anything they should know?" name="description" maxLength={1000} />
        <FieldError state={state} name="description" />
      </div>

      <Select label="Type" name="seshType" options={SESH_TYPE_OPTIONS} />

      <div className="flex flex-col gap-1.5">
        <Input label="Starts (Florida time)" name="startsAtLocal" type="datetime-local" required />
        <FieldError state={state} name="startsAtLocal" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Input label="How many guests?" name="capacity" type="number" min={1} max={50} defaultValue={6} required />
        <p className="text-sm text-ink-muted">You are not one of the spots.</p>
        <FieldError state={state} name="capacity" />
      </div>

      <fieldset className="flex flex-col gap-4 rounded-card bg-surface p-4">
        <legend className="px-1 text-sm font-medium text-ink-muted">Where</legend>
        <p className="text-sm text-ink">
          Nobody sees this until you approve them. The feed and the map show a circle about 800 m
          across instead, and it never sits on your front door.
        </p>

        <div className="flex flex-col gap-1.5">
          <Input label="Street address" name="addressLine" required maxLength={200} />
          <FieldError state={state} name="addressLine" />
        </div>

        <Input label="Unit or buzzer (optional)" name="unitNote" maxLength={60} />
        <Input label="Gate code (optional)" name="gateCode" maxLength={40} />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Input label="Latitude" name="exactLat" type="number" step="any" required placeholder="27.9506" />
            <FieldError state={state} name="exactLat" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Input label="Longitude" name="exactLng" type="number" step="any" required placeholder="-82.4572" />
            <FieldError state={state} name="exactLng" />
          </div>
        </div>
        <p className="text-sm text-ink-muted">A map to drop a pin on is coming; for now, type the numbers.</p>
      </fieldset>

      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post the sesh"}
      </Button>
    </form>
  );
}
