"use client";

import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function Input({ label, className = "", ...props }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        className={`rounded-control border border-rule bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none ${className}`}
        {...props}
      />
    </div>
  );
}
