---
version: 1
slug: "route"
primary_target: "route:/"
related_targets: ["route:/login"]
---

# Shape brief: the landing page

Issue #97, pass 1 (design, no code). Written 2026-09-26. The owner picked
"The Fuzzy Circle" over "Plain Questions", and added one rule in their own
words: no blurred-out look; it must be executed properly. The look is Warm
Ink, recorded in `DESIGN.md`. #97's body is the spec; this brief owns the
page's structure and direction.

## 1. Job and audience

- **Who:** a signed-out stranger on a phone, arriving from a shared link, the
  TEKGUYZ portfolio, or a search. Often wary. Sometimes a signed-out member.
- **Mode:** Persuade. The stranger decides whether this is for them and
  whether it is safe, then signs up.
- **The job:** in one screen, say what Meet4Weed is, who it is for, and show
  why it is safe. Then offer Sign up.

## 2. Outcome and proof

- Success: a stranger can say, an hour later, "the address is hidden until
  the host says yes, and a real person checks every card."
- Proof is the product's own mechanism, drawn: the same shaded circle the
  feed map shows (about half a mile across, never centred on the door).
- Only the claims #97 lists as true today. No testimonials, member counts,
  press or screenshots of real members.

## 3. Selected direction

- **Visual authority:** Warm Ink, tokens only, from `DESIGN.md`. The landing
  page may push further than a member screen, but not break its rules.
- **Structural thesis:** show the hiding, do not describe it. A drawn map
  with one crisp circle leads; four steps below explain what opens it.
- **Focal moment:** the circle on the map, and at step 4 one pin appearing
  inside it, off-centre.
- **Implementation consequence:** the map is authored vector art in the page,
  not MapLibre and not a raster. It reads no data. Build path is code-led
  (no image generation on this machine).

## 4. Scope and boundaries

- **In:** the landing page, its footer, the empty demo slot.
- **Out:** routing, robots, sitemap (pass 2); the demo button (#39).
- **Untouched:** `app/globals.css` values, the member home at `/`, `/login`
  apart from its one link back.
- **Anti-goals:** blur, frosted glass, gaussian haze or any "censored" look;
  a stock hero with a phone mockup; leaf or smoke imagery; hype; gradients as
  decoration; a marketing-site feature grid of icon tiles.

## 5. States and ranges

- Phone first, 375px base; wide screens get the same story with the map
  beside the words, not a stretched column.
- Dark default and light (paper) both full themes, both WCAG 2.2 AA.
- Reduced motion: every step's final state shows at once. Content is never
  hidden waiting for motion.
- No JavaScript: the page still reads completely.

## 6. Interaction and layout

- Top bar: wordmark left, a quiet Sign in right.
- First viewport: the map (upper part), the headline, the who-it-is-for line,
  the sage Sign up. Sign up sits in thumb reach without scrolling at 375×667.
- Four steps below, one idea each, tied to the map as the reader scrolls.
- Then the two plain promises (never a sale; photos deleted), a second Sign
  up, then the footer.

## 7. Constraints and open decisions

- Headline and step copy are drafts; the copy pass in pass 3 words them. The
  words must stay inside #97's allowed claims.
- The demo slot's label belongs to #39.
- The link-preview image stays the existing one unless the build shows it
  must change; then change `scripts/logo.mjs` and re-run `npm run icons`.

## Direction contract

THESIS: The page shows the hiding itself: the same crisp half-mile circle the
feed map draws, with the address held back until a person says yes. It
refuses the category default of a phone-mockup hero with feature tiles, and
refuses any blurred or censored look.

OWN-WORLD: Warm Night field, a drawn street map in Charred Rule and Ember
tones with no names, one Sage-shaded circle with a clean 1.5px Sage edge,
Fraunces headline, Inter body, Sage used only for the circle and Sign up.
Flat, no shadows, card and control radii.

STORY: The stranger sees a map with a circle and reads "The address stays
hidden until the host says yes." They learn who it is for, walk four checks
(live card and face, a person approves, the host approves, the address at 12
hours and forgotten at 7 days), read "never a sale", and sign up.

FIRST VIEWPORT: Top 45%: the map, the circle slightly right of centre. Below:
the Display headline over two lines, one muted line naming Florida OMMU
cardholders 21+, then the full-width Sage Sign up. Quiet Sign in top right.

FORM: The Fuzzy Circle, position 1 of 7 on the ranked list; seed key
62da300e. Signature interaction: as each step scrolls in, the map answers it
(the circle ring draws, the check marks settle, and at step 4 a pin drops
inside the circle, off-centre). Motion grammar: one slow, calm ease; nothing
bounces.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance
