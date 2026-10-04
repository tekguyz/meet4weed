import type { ReactNode } from "react";
import { SESH_TYPE_LABELS, type SeshType } from "@/lib/sesh/schema";

/**
 * One drawing per sesh type (#125): the sesh's poster, since a sesh never has
 * a photo. Authored vector art in the Landing map's hand (components/landing/
 * landing-map.tsx): round-capped Dusk Ink lines on Ember Card shapes, one soft
 * accent tint. No people, no faces, no cannabis leaf.
 *
 * A 160 × 72 scene, fitted whole into whatever band it sits in. On a band
 * wider than the scene, the ground, rows and water run on past the scene's
 * edges to the band's, so a wide band is never a small picture in a box.
 * Every fill and stroke is a token class.
 *
 * Named by its sesh type for a screen reader ("Movie night"), never described
 * as art: the drawing is how a sighted member tells the type at a glance.
 */
export function SeshTypeArt({ type, className = "" }: { type: SeshType; className?: string }) {
  return (
    // The box clips what runs past the scene; the svg itself shows it.
    <span className={`block overflow-hidden bg-surface-2 ${className}`}>
      <svg
        viewBox="0 0 160 72"
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
        role="img"
        aria-label={SESH_TYPE_LABELS[type]}
        focusable="false"
        className="size-full"
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          {SCENES[type]}
        </g>
      </svg>
    </span>
  );
}

/** Eight friends round the smoke circle's ellipse, back row drawn first. Turned
 *  a sixteenth so nobody sits where the wisp rises. */
const RING = Array.from({ length: 8 }, (_, i) => {
  const angle = ((i + 0.5) / 8) * 2 * Math.PI;
  return [Math.round(80 + 52 * Math.cos(angle)), Math.round(50 + 15 * Math.sin(angle))] as const;
}).sort((a, b) => a[1] - b[1]);

/** Seat-back columns in the movie night's front row, running on past the
 *  scene both ways. */
const SEATS = Array.from({ length: 23 }, (_, i) => 26 + (i - 8) * 18);

/** The shared line: Dusk Ink, 2 wide, on an Ember Card fill. */
const LINE = "fill-surface stroke-ink-muted";

const SCENES: Record<SeshType, ReactNode> = {
  // A sofa under one lamp: the Warm Ink room itself.
  chill: (
    <>
      <circle cx={118} cy={26} r={24} className="fill-secondary/15" />
      <line x1={-400} y1={60} x2={560} y2={60} className="stroke-rule" strokeWidth={2} />
      <line x1={118} y1={26} x2={118} y2={60} className="stroke-ink-muted" strokeWidth={2} />
      <line x1={111} y1={60} x2={125} y2={60} className="stroke-ink-muted" strokeWidth={2.5} />
      <path d="M110 14 H126 L131 27 H105 Z" className="fill-secondary/40 stroke-secondary" strokeWidth={1.5} />
      <rect x={34} y={28} width={58} height={20} rx={6} className={LINE} strokeWidth={2} />
      <line x1={63} y1={31} x2={63} y2={45} className="stroke-ink-muted" strokeWidth={1.5} />
      <rect x={30} y={42} width={66} height={12} rx={4} className={LINE} strokeWidth={2} />
      <rect x={23} y={35} width={12} height={21} rx={5} className={LINE} strokeWidth={2} />
      <rect x={91} y={35} width={12} height={21} rx={5} className={LINE} strokeWidth={2} />
      <path d="M32 56 V60 M94 56 V60" className="stroke-ink-muted" strokeWidth={2} />
    </>
  ),

  // A ring of friends, seen from the side, with a wisp rising from the middle.
  smoke_circle: (
    <>
      <ellipse cx={80} cy={50} rx={52} ry={15} className="fill-secondary/15 stroke-secondary" strokeWidth={1.5} />
      {RING.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={6.5} className={LINE} strokeWidth={2} />
      ))}
      <circle cx={80} cy={50} r={3} className="fill-secondary" />
      <path
        d="M79 46 C 72 38, 88 32, 79 24 S 86 12, 81 6 M84 46 C 92 38, 80 30, 90 20"
        className="fill-none stroke-ink-muted"
        strokeWidth={1.5}
      />
    </>
  ),

  // A glowing screen over two rows of seat backs.
  movie_night: (
    <>
      <rect x={34} y={5} width={92} height={40} rx={4} className="fill-secondary/15 stroke-secondary" strokeWidth={1.5} />
      <path d="M73 17 L90 25 L73 33 Z" className="fill-secondary" />
      {[0, 1].map((row) =>
        SEATS.map((x) => (
          <rect
            key={`${row}-${x}`}
            x={x + row * 9 - 4}
            y={51 + row * 11}
            width={14}
            height={10}
            rx={5}
            className={LINE}
            strokeWidth={2}
          />
        )),
      )}
    </>
  ),

  // A fanned hand of cards and two dice on a round table.
  game_night: (
    <>
      <circle cx={80} cy={38} r={31} className="fill-primary/15" />
      {[-18, 0, 18].map((angle) => (
        <rect
          key={angle}
          x={46}
          y={22}
          width={22}
          height={32}
          rx={3}
          transform={`rotate(${angle} 57 62)`}
          className={LINE}
          strokeWidth={2}
        />
      ))}
      <path d="M57 30 L62 38 L57 46 L52 38 Z" transform="rotate(18 57 62)" className="fill-secondary" />
      <g transform="rotate(12 99 37)">
        <rect x={88} y={26} width={22} height={22} rx={5} className={LINE} strokeWidth={2} />
        {[[93, 31], [99, 37], [105, 43]].map(([cx, cy]) => (
          <circle key={cx} cx={cx} cy={cy} r={2} className="fill-ink-muted" />
        ))}
      </g>
      <g transform="rotate(-10 121 49)">
        <rect x={112} y={40} width={18} height={18} rx={4} className={LINE} strokeWidth={2} />
        {[[117, 45], [125, 45], [117, 53], [125, 53]].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.75} className="fill-ink-muted" />
        ))}
      </g>
    </>
  ),

  // Florida outside: a low sun, a palm, rolling ground and water.
  outdoors: (
    <>
      <circle cx={118} cy={22} r={10} className="fill-secondary/30 stroke-secondary" strokeWidth={1.5} />
      <path d="M-400 50 C -300 40, -160 62, -4 56 C 28 38, 56 40, 82 52 S 132 36, 164 46 C 260 58, 420 36, 560 50 V 76 H -400 Z" className="fill-primary/15" />
      <path d="M-400 50 C -300 40, -160 62, -4 56 C 28 38, 56 40, 82 52 S 132 36, 164 46 C 260 58, 420 36, 560 50" className="fill-none stroke-primary" strokeWidth={1.5} />
      <path d="M44 50 C 47 40, 42 28, 48 17" className="fill-none stroke-ink-muted" strokeWidth={2.5} />
      <path
        d="M48 17 C 40 11, 31 13, 27 20 M48 17 C 56 9, 65 11, 69 18 M48 17 C 46 9, 50 4, 57 4 M48 17 C 42 15, 36 21, 36 28 M48 17 C 55 15, 61 21, 61 28"
        className="fill-none stroke-ink-muted"
        strokeWidth={2}
      />
      <path d="M92 64 q 6 -4 12 0 t 12 0 t 12 0 M110 69 q 6 -4 12 0 t 12 0" className="fill-none stroke-ink-muted" strokeWidth={1.5} />
    </>
  ),

  // A painter's palette and a brush mid-stroke.
  creative: (
    <>
      <path
        d="M44 20 C 60 5, 104 5, 116 21 C 126 35, 112 45, 100 41 C 92 39, 88 47, 94 53 C 100 61, 78 66, 61 59 C 40 51, 30 32, 44 20 Z"
        className={LINE}
        strokeWidth={2}
      />
      <circle cx={53} cy={31} r={5} className="fill-secondary" />
      <circle cx={67} cy={19} r={5} className="fill-primary/60" />
      <circle cx={84} cy={16} r={5} className="fill-ink-muted" />
      <circle cx={101} cy={22} r={5} className="fill-secondary/50" />
      <path d="M120 66 c 6 -6 12 6 18 0 s 12 6 18 0" className="fill-none stroke-secondary" strokeWidth={2} />
      <line x1={118} y1={58} x2={146} y2={10} className="stroke-ink-muted" strokeWidth={3} />
      <path d="M118 58 c -4 2, -6 6, -6 9 c 4 0, 8 -2, 10 -6 Z" className="fill-secondary stroke-secondary" strokeWidth={1.5} />
    </>
  ),
};
