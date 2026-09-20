"use client";

import { useId, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

/** A checkbox whose label is clickable. `useId` ties the two together, the
 *  same way Input does — a label that only looks like a label is a miss
 *  target on a phone and invisible to a screen reader. */
export function Checkbox({ label, className = "", ...props }: Props) {
  const id = useId();

  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className={`mt-0.5 size-5 shrink-0 rounded-sm border border-rule bg-surface accent-primary focus:border-primary focus:outline-none ${className}`}
        {...props}
      />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
    </div>
  );
}
