/**
 * The landing page's map (#97): a drawn street map with no names, one shaded
 * circle about half a mile across, and — once the three checks pass — one pin
 * inside it, off-centre, never at the middle. The same circle the feed map
 * draws (components/sesh/sesh-map.tsx), authored as vector art: it reads no
 * data and loads no map library.
 *
 * `step` says how far the story has scrolled. Each layer carries `data-on`;
 * globals.css hides an off layer. Without JavaScript the final state shows.
 */

/** Circle centre and radius in the 400 × 400 viewBox, slightly right of centre. */
const CX = 222;
const CY = 196;
const R = 78;

/** The pin's tip. Inside the circle, well away from its middle, as a real
 *  address is. */
const PIN = { x: 266, y: 232 };

/** Height of the dimension line above the circle. */
const DIM_Y = CY - R - 12;

/** Minor streets: a loose grid, tilted a few degrees so it reads as a real
 *  neighbourhood rather than graph paper. */
const MINOR_X = [18, 62, 104, 176, 212, 252, 346, 386];
const MINOR_Y = [28, 70, 150, 196, 282, 322, 364];

const CANAL = "M-20 112 C 40 92, 84 158, 160 146 S 262 62, 420 88";

/** A map pin whose tip is at (x, y), 28 wide and 39 tall. */
function pinPath(x: number, y: number) {
  return `M${x} ${y} c -9 -11 -14 -18 -14 -25 a 14 14 0 0 1 28 0 c 0 7 -5 14 -14 25 z`;
}

/** The three checks, in the order the page tells them. The pin is the fourth
 *  step: not a check, but what the checks open. */
export const CHECKS = ["Card", "Person", "Host"] as const;

export function LandingMap({ step }: { step: number }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-surface md:rounded-card">
      <svg
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="A street map with one shaded circle about half a mile across. No house is marked on it."
        focusable="false"
      >
        {/* A canal, because this is Florida: a band with two banks, so it reads
            as water and not as one more road. Roads cross it as bridges. */}
        <path d={CANAL} className="fill-none stroke-rule" strokeWidth={17} strokeLinecap="round" />
        <path d={CANAL} className="fill-none stroke-bg" strokeWidth={13} strokeLinecap="round" />

        <g transform="rotate(-4 200 200)" className="stroke-rule" strokeWidth={2.5} strokeLinecap="round">
          {MINOR_X.map((x) => (
            <line key={`x${x}`} x1={x} y1={-40} x2={x} y2={440} />
          ))}
          {MINOR_Y.map((y) => (
            <line key={`y${y}`} x1={-40} y1={y} x2={440} y2={y} />
          ))}
        </g>

        <g className="fill-none stroke-rule" strokeWidth={8} strokeLinecap="round">
          <path d="M-20 250 C 110 232, 250 274, 420 238" />
          <path d="M136 -20 L 150 420" />
          <path d="M306 -20 C 294 110, 326 262, 310 420" />
        </g>

        {/* The one thing the public sees of a sesh. A crisp edge: nothing
            here is blurred or "censored" (brief, anti-goals). */}
        <circle cx={CX} cy={CY} r={R} className="fill-primary/15" />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          // No non-scaling stroke here: Chrome then measures the draw-in dash
          // in screen pixels, and the ring stops part way round.
          pathLength={1}
          className="landing-ring fill-none stroke-primary"
          strokeWidth={1.5}
        />

        {/* A dimension line as wide as the circle, so the size is a reading,
            not a claim. The halo keeps the words off the canal. */}
        <g className="stroke-ink-muted" strokeWidth={1} vectorEffect="non-scaling-stroke">
          <line x1={CX - R} y1={DIM_Y} x2={CX + R} y2={DIM_Y} />
          <line x1={CX - R} y1={DIM_Y - 5} x2={CX - R} y2={DIM_Y + 5} />
          <line x1={CX + R} y1={DIM_Y - 5} x2={CX + R} y2={DIM_Y + 5} />
        </g>
        <text
          x={CX}
          y={DIM_Y - 9}
          textAnchor="middle"
          className="fill-ink-muted stroke-surface text-xs"
          strokeWidth={4}
          paintOrder="stroke"
        >
          about ½ mile
        </text>

        <g data-on={step >= 4} className="landing-pin">
          <path d={pinPath(PIN.x, PIN.y)} className="fill-ink" />
          <circle cx={PIN.x} cy={PIN.y - 25} r={5} className="fill-surface" />
        </g>
      </svg>
    </div>
  );
}

/** The three checks under the map: a legend, not buttons. A pending check is a
 *  dashed ring; a passed one fills in. Hidden from screen readers, because the
 *  steps say the same thing in full. */
export function CheckLegend({ step }: { step: number }) {
  return (
    <ol aria-hidden="true" className="flex items-center gap-5 px-4 py-2.5 text-sm text-ink md:px-1">
      {CHECKS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span className="relative size-4 rounded-full border border-dashed border-ink-muted">
            <svg data-on={step > i} viewBox="0 0 16 16" className="landing-check absolute -inset-px size-4" focusable="false">
              <circle cx={8} cy={8} r={8} className="fill-ink" />
              <path
                d="M4.5 8.5 L7 11 L11.5 5.5"
                className="fill-none stroke-bg"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

/** The map's last step, small: the circle with its pin. It closes the page. */
export function CircleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <circle cx={24} cy={24} r={22} className="fill-primary/15 stroke-primary" strokeWidth={1.5} />
      <g transform="translate(29 34) scale(0.6) translate(-29 -34)">
        <path d={pinPath(29, 34)} className="fill-ink" />
        <circle cx={29} cy={9} r={5} className="fill-surface" />
      </g>
    </svg>
  );
}
