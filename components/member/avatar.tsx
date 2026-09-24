import { avatarInitials, avatarLook } from "@/lib/profiles/avatar";

type Props = {
  /** profiles.avatar_seed. Null draws from the member id. */
  seed: string | null;
  memberId: string;
  handle: string;
  displayName: string | null;
  /** Size classes. Defaults to size-10. */
  className?: string;
};

/**
 * The Avatar (issue #69): a generated mark, never a photo. Initials on a shape,
 * picked from the seed.
 *
 * In-house rather than boring-avatars: its "beam" style reads each colour as
 * hex to choose the face colour, so a `var(--…)` colour always gets a
 * hard-coded #FFFFFF face. Colours live only in app/globals.css, so every fill
 * here is a token class.
 *
 * Decorative: the handle always sits beside it, so a screen reader skips it.
 */
export function Avatar({ seed, memberId, handle, displayName, className = "size-10" }: Props) {
  const look = avatarLook(seed, memberId);
  const tone = TONES[look.tone];
  const initials = avatarInitials(handle, displayName);
  const [cx, cy] = ACCENTS[look.accent];

  return (
    <svg data-avatar aria-hidden="true" viewBox="0 0 40 40" className={`shrink-0 ${className}`}>
      <Shape index={look.shape} className={tone.shape} />
      <circle cx={cx} cy={cy} r={3} className={tone.accent} />
      <text
        x={20}
        y={20}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={initials.length > 1 ? 14 : 17}
        className={`font-body font-semibold ${tone.ink}`}
      >
        {initials}
      </text>
    </svg>
  );
}

/** Shape fill, initials fill and accent dot, as full class names so Tailwind
 *  finds them. Each pair swaps with the theme through the tokens. */
const TONES = [
  { shape: "fill-primary", ink: "fill-on-primary", accent: "fill-secondary" },
  { shape: "fill-ink", ink: "fill-bg", accent: "fill-primary" },
  { shape: "fill-surface-2 stroke-rule", ink: "fill-ink", accent: "fill-secondary" },
  { shape: "fill-secondary", ink: "fill-on-primary", accent: "fill-primary" },
];

/** Inside every shape and clear of the initials. */
const ACCENTS: [number, number][] = [
  [20, 6],
  [34, 20],
  [20, 34],
  [6, 20],
];

function Shape({ index, className }: { index: number; className: string }) {
  switch (index) {
    case 0:
      return <circle cx={20} cy={20} r={19.5} className={className} />;
    case 1:
      return <rect x={0.5} y={0.5} width={39} height={39} rx={10} className={className} />;
    case 2:
      return <path d="M20 0.5 39.5 20 20 39.5 0.5 20Z" strokeLinejoin="round" className={className} />;
    default:
      return <path d="M20 0.5 37 10.25v19.5L20 39.5 3 29.75v-19.5Z" className={className} />;
  }
}
