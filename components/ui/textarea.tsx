"use client";

import { useId, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string };

/** The multi-line twin of Input, down to the label styling, so a form built
 *  from both does not look like two different apps. */
export function Textarea({ label, className = "", rows = 4, ...props }: Props) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-muted">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        className={`rounded-control border border-rule bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none ${className}`}
        {...props}
      />
    </div>
  );
}
