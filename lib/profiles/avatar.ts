/**
 * The Avatar's look, worked out from a seed (issue #69). Pure, so the server
 * and the browser draw the same mark.
 *
 * A null seed means "derive from the member id", so no profile is ever blank
 * and a member who never presses Shuffle still has a mark of their own.
 */

export type AvatarLook = {
  /** Index into the component's shapes. */
  shape: number;
  /** Index into the component's tone pairs. */
  tone: number;
  /** Which edge the accent dot sits on. */
  accent: number;
};

export const SHAPE_COUNT = 4;
/** The component's tables are typed to these lengths, so they cannot drift. */
export const TONE_COUNT = 4;
export const ACCENT_COUNT = 4;

/** FNV-1a, 32-bit. Stable across runtimes; not for anything secret. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function avatarLook(seed: string | null, memberId: string): AvatarLook {
  const h = hash(seed ?? memberId);
  return {
    shape: h % SHAPE_COUNT,
    tone: (h >>> 8) % TONE_COUNT,
    accent: (h >>> 16) % ACCENT_COUNT,
  };
}

export function sameLook(a: AvatarLook, b: AvatarLook): boolean {
  return a.shape === b.shape && a.tone === b.tone && a.accent === b.accent;
}

/** First letters of the first two words of the display name, else the
 *  handle's first letter. */
export function avatarInitials(handle: string, displayName: string | null): string {
  const words = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 0 ? words.slice(0, 2).map((word) => word[0]) : [handle[0] ?? ""];
  return letters.join("").toUpperCase();
}
