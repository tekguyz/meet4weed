"use client";

import { useId, type SelectHTMLAttributes } from "react";

export type SelectOption = { value: string; label: string };

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: readonly SelectOption[];
};

/** A native select. The options carry a separate `value` and `label` because
 *  what the database stores and what a member should read are not the same
 *  string — `smoke_circle` is a Postgres enum value, "Smoke circle" is not. */
export function Select({ label, options, className = "", ...props }: Props) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-muted">
        {label}
      </label>
      <select
        id={id}
        className={`rounded-control border border-rule bg-surface px-4 py-3 text-base text-ink focus:border-primary focus:outline-none ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
