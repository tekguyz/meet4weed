---
target: landing page
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Projects\\meet4weed\\app\\landing\\page.tsx"
target_fingerprint: "sha256:28fdaa05fc7fed26838245513df77b6b6f404c887e7b60eb77b64e3ff8484de6"
target_path: "C:\\Projects\\meet4weed\\app\\landing\\page.tsx"
timestamp: 2026-09-27T01-12-38Z
slug: app-landing-page-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Map answers the scroll; 3 chips for 4 steps; check 1 lit on load at 1024x768 |
| 2 | Match System / Real World | 2 | "sesh", "bring list", OMMU unexplained; "checked live" implies live human review |
| 3 | User Control and Freedom | 3 | Nothing traps; Sign in in header and CTA card |
| 4 | Consistency and Standards | 2 | "Four checks" but step 4 is the outcome; empty-ring chips read as filter chips/radios |
| 5 | Error Prevention | 3 | Who can join stated before both Sign ups |
| 6 | Recognition Rather Than Recall | 3 | Pinned map keeps state in view |
| 7 | Flexibility and Efficiency | n/a | One-path Persuade page |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained; desktop map mostly empty; flat ending |
| 9 | Error Recovery | 3 | Little can fail; Help in footer |
| 10 | Help and Documentation | n/a | Landing page |
| Total | | 22/32 | Good |

## Design Specificity Verdict
Authored for this product: the drawn half-mile circle, dimension line, canal, and pin after three checks. Weak spot: everything around the map is a stock layout, and nothing product-specific returns after the pin.
Detector: exit 0. Advisory design-system-font-size at landing-map.tsx:88 (13px SVG text; false positive, SVG units). Browser: overused-font Inter 72% (false positive, DESIGN.md), first-viewport-column-overflow on desktop grid (false positive, intended sticky story).

## Priority Issues
- [P1] "Four checks" vs three chips; step 4 is the outcome, not a check. Fix: "Three checks, then the address" and set step 4 apart, or add a fourth map state.
- [P1] Jargon and one misleading phrase: sesh, bring list, OMMU unexplained; "checked live" suggests live human review. Fix: "captured live", gloss sesh once, name OMMU once.
- [P1] Map chips: empty rings at ~1.4:1 read as inert or tappable; wrap to two rows at 320px and landscape and cover the circle. Fix: short labels, clearer pending state.
- [P2] Short viewports: Sign up below the fold at 320x568 and at 812x375 (md layout + 5xl h1). Fix: gate two-column/5xl on height, clamp h1.
- [P2] "Never keeps your photos" overclaims next to "within seven days". Fix: "Deletes your photos".
- [P2] No-JS: in dev, / streams under app/loading.tsx so no-JS shows only "Loading". Check a production build.

## Persona Red Flags
- Wary first-timer: meets "sesh" and "bring list" cold; headline speaks to the host's fear first.
- Screen-reader user: good structure; the map and its reveal are aria-hidden, no text alternative.
- Returning member: fine.

## Minor Observations
- Ring dash seam nub at 3 o'clock. Light theme: canal reads as a road; chip backgrounds vanish on white. Pin looks near-centred at phone size. Desktop "about ½ mile" renders ~21px. Ending does not echo the pin.

## Questions
- Would one honest line on what a sesh is persuade more than a fourth safety claim?
- Should the ending echo the circle and pin?
