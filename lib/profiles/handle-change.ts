/**
 * Issue #70. public.change_handle() refuses with its own SQLSTATE; this turns
 * one into a sentence for the handle field. A raw `M4W31` on screen is a bug,
 * not an error message. Shared by onboarding and Settings → Handle.
 */

import type { ActionState } from "@/lib/forms/action-state";
import { HANDLE_FORMAT_MESSAGE } from "@/lib/profiles/schema";

const FLORIDA_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const HANDLE_FAILED = "Could not change your handle. Try again.";

export function handleChangeMessage(error: { code?: string; details?: string | null }): string {
  switch (error.code) {
    // change_handle() turns a unique-key race into M4W30. 23505 stays as the
    // backstop if a later write path ever skips the function.
    case "M4W30":
    case "23505":
      return "That handle is taken. Try another.";
    case "M4W31":
      return "That handle was given up in the last 30 days. It stays locked so nobody can pose as its old owner. Try another.";
    case "M4W32": {
      const at = error.details ? new Date(error.details) : null;
      const when = at && !Number.isNaN(at.getTime()) ? ` You can change it again on ${FLORIDA_DAY.format(at)}.` : "";
      return `You can change your handle once every 30 days.${when}`;
    }
    case "M4W33":
      return HANDLE_FORMAT_MESSAGE;
    default:
      return HANDLE_FAILED;
  }
}

/** What both forms return when change_handle() refuses. */
export function handleRefused(error: { code?: string; details?: string | null }): ActionState {
  return {
    ok: false,
    message: "Check the highlighted fields.",
    fieldErrors: { handle: handleChangeMessage(error) },
  };
}
