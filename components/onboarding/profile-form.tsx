"use client";

import { useActionState } from "react";
import { saveProfile } from "@/app/onboarding/actions";
import type { ActionState } from "@/lib/forms/action-state";
import { Banner, FieldError } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CONSUMPTION_METHODS,
  RESERVED_HANDLE_PREFIX,
  STRAIN_TYPES,
  type Profile,
} from "@/lib/profiles/schema";

function CheckGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  selected: string[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-control bg-surface-2 px-3 py-2 text-sm capitalize text-ink has-checked:bg-primary has-checked:text-on-primary"
          >
            <input
              type="checkbox"
              name={name}
              value={option}
              defaultChecked={selected.includes(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(saveProfile, null);

  // The signup trigger writes a `member_<hex>` placeholder. Showing it in the
  // field would invite the member to keep it, and the schema rejects it.
  const startsFresh = profile.handle.startsWith(RESERVED_HANDLE_PREFIX);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Input
          label="Handle"
          name="handle"
          required
          defaultValue={startsFresh ? "" : profile.handle}
          placeholder="ryder_420"
          aria-describedby="handle-help"
        />
        <p id="handle-help" className="text-xs text-ink-muted">
          3–20 characters. Letters, numbers and underscores. This is how people find you.
        </p>
        <FieldError message={state?.fieldErrors?.handle} />
      </div>

      <ProfileFields profile={profile} errors={state?.fieldErrors} />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>

      {/* Failures only: saveProfile redirects home on success, so an ok state
          never reaches this component. */}
      {state && !state.ok ? (
        <Banner tone="danger" urgent>
          {state.message}
        </Banner>
      ) : null}
    </form>
  );
}

type FieldsProps = {
  profile: Pick<Profile, "displayName" | "bio" | "city" | "strainPrefs" | "methodPrefs" | "vibeTags">;
  errors?: Record<string, string>;
};

/** Everything on a profile but the handle. Shared by onboarding's last step
 *  and Settings → Edit profile (issue #65), so the two never drift. */
export function ProfileFields({ profile, errors }: FieldsProps) {
  return (
    <>
      <Input label="Display name" name="displayName" defaultValue={profile.displayName ?? ""} />
      <Input
        label="City"
        name="city"
        defaultValue={profile.city ?? ""}
        placeholder="Wilton Manors"
      />
      <div className="flex flex-col gap-1.5">
        <Textarea
          label="Bio"
          name="bio"
          rows={3}
          maxLength={280}
          defaultValue={profile.bio ?? ""}
          placeholder="Indica after 8pm."
        />
        <FieldError message={errors?.bio} />
      </div>

      <CheckGroup
        legend="Strains you reach for"
        name="strainPrefs"
        options={STRAIN_TYPES}
        selected={profile.strainPrefs}
      />
      <CheckGroup
        legend="How you consume"
        name="methodPrefs"
        options={CONSUMPTION_METHODS}
        selected={profile.methodPrefs}
      />

      <div className="flex flex-col gap-1.5">
        <Input
          label="Vibe tags"
          name="vibeTags"
          defaultValue={profile.vibeTags.join(", ")}
          placeholder="vinyl, board games, hiking"
          aria-describedby="tags-help"
        />
        <p id="tags-help" className="text-xs text-ink-muted">
          Up to eight, separated by commas.
        </p>
        <FieldError message={errors?.vibeTags} />
      </div>
    </>
  );
}
