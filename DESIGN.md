---
name: Meet4Weed
description: A private circle for verified Florida patients.
colors:
  warm-night: "oklch(18.31% 0.0085 84.57)"
  ember-card: "oklch(21.60% 0.0129 77.94)"
  ember-raised: "oklch(24.26% 0.0149 76.18)"
  charred-rule: "oklch(28.83% 0.0195 80.41)"
  cream-ink: "oklch(95.58% 0.0168 88.00)"
  dusk-ink: "oklch(69.43% 0.0317 80.59)"
  sage: "oklch(83.85% 0.1202 127.58)"
  sage-pressed: "oklch(77.35% 0.1204 127.99)"
  on-sage: "oklch(18.79% 0.0203 125.99)"
  honey: "oklch(81.04% 0.1127 80.25)"
  clay: "oklch(68.35% 0.1405 35.10)"
  paper: "oklch(97.35% 0.0139 88.68)"
  paper-card: "oklch(100% 0 89.88)"
  paper-raised: "oklch(94.37% 0.0209 88.72)"
  paper-rule: "oklch(88.10% 0.0286 86.65)"
  paper-ink: "oklch(21.47% 0.0122 84.54)"
  paper-ink-muted: "oklch(49.99% 0.0270 82.01)"
  sage-deep: "oklch(55.50% 0.1076 129.11)"
  sage-deep-pressed: "oklch(48.62% 0.0984 129.59)"
  on-sage-deep: "oklch(100% 0 89.88)"
  honey-deep: "oklch(60.36% 0.1161 75.43)"
  clay-deep: "oklch(52.60% 0.1547 33.86)"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: "2.25rem"
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  input:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  control: "0.875rem"
  card: "1.125rem"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  page-top: "40px"
components:
  button-primary:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.on-sage}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.sage-pressed}"
    textColor: "{colors.on-sage}"
  button-quiet:
    backgroundColor: "{colors.ember-raised}"
    textColor: "{colors.cream-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-quiet-hover:
    backgroundColor: "{colors.charred-rule}"
    textColor: "{colors.cream-ink}"
  input:
    backgroundColor: "{colors.ember-card}"
    textColor: "{colors.cream-ink}"
    typography: "{typography.input}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.ember-raised}"
    textColor: "{colors.cream-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  chip-selected:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.on-sage}"
  card:
    backgroundColor: "{colors.ember-card}"
    textColor: "{colors.cream-ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  card-nested:
    backgroundColor: "{colors.ember-raised}"
    rounded: "{rounded.card}"
    padding: "12px"
---

# Design System: Meet4Weed

<!-- Recorded from the code (app/globals.css, components/ui/) and spec §7 on
     2026-09-23. This file RECORDS Warm Ink. It does not propose a new look.
     app/globals.css is the only place a colour value lives in the app; if this
     file and that one disagree, globals.css wins and this file is stale. -->

## Overview

**Creative North Star: "Warm Ink"**

A late-evening room lit by one lamp. The field is a warm brown-black, never a
neutral or blue black. Text is cream, not white. The single living colour is a
soft sage, used for the one thing to do next. Honey-gold is the second voice,
kept for strain tags, notices and small accents. Headings are set in Fraunces,
a warm serif with a slight softness; everything else is Inter.

The system is calm and quiet on purpose. It is used on a phone, often at
night, often where someone might glance at the screen. Nothing glows, nothing
shouts, and nothing looks like cannabis branding. Depth comes from stepping
the surface a shade lighter, not from shadows. Shapes are generously rounded,
so the app reads as soft and friendly rather than as a tool.

Dark is the default and the design reference. Light mode ("paper") uses the
same token names, re-pointed, and is a full theme, not an afterthought.

**Rejected (spec §7):** the prototype's cold neon-green-on-black terminal look
and Razer-style hot green (read as a tool, tiring at night); Material You (it
is Google's brand, not ours); a stock Tailwind default look.

**Key Characteristics:**
- Warm brown-black field, cream ink, one sage action colour.
- Serif headings (Fraunces) over a neutral sans body (Inter).
- Flat surfaces; depth by tonal steps.
- Big rounded cards, fat rounded controls.
- Every colour comes from a token; both themes swap at runtime.

## Colors

A warm, low-chroma neutral ramp carrying two restrained accents — sage for
action, honey for accent — and one clay red for danger.

Every value lives only in `app/globals.css`. Components use the token classes
`bg-bg`, `bg-surface`, `bg-surface-2`, `border-rule`, `text-ink`,
`text-ink-muted`, `bg-primary`, `bg-primary-pressed`, `text-on-primary`,
`text-secondary` and `text-danger`. The frontmatter names map to them as below.

### Primary
- **Sage** (`--primary`, dark): primary buttons, the selected chip, the active
  tab, the key link. The one colour that says "do this".
- **Sage Pressed** (`--primary-pressed`): hover and pressed state of a sage
  button.
- **On Sage** (`--on-primary`): text on a sage fill. Near-black green in dark.
- **Deep Sage** (`--primary`, light): the light theme's sage, darkened hard so
  white text on it clears 4.5:1. **On Deep Sage** is white.

### Secondary
- **Honey** (`--secondary`): strain tags, the expiry banner, the "host changed
  this sesh" notice, accents. Never a button fill. **Deep Honey** in light.

### Tertiary
- **Clay** (`--danger`): errors, destructive actions, a rejected card's
  reason. **Deep Clay** in light.

### Neutral
- **Warm Night** (`--bg`): the page field.
- **Ember Card** (`--surface`): cards, inputs, panels.
- **Ember Raised** (`--surface-2`): quiet buttons, unselected chips, a card
  nested inside a card, the theme toggle's track.
- **Charred Rule** (`--rule`): input borders, dividers, quiet-button hover.
- **Cream Ink** (`--ink`): body text and headings.
- **Dusk Ink** (`--ink-muted`): labels, secondary text, placeholders.
- **Paper** family: the same six roles in the light theme — Paper, Paper
  Card (white), Paper Raised, Paper Rule, Paper Ink, Paper Ink Muted.

### Named Rules

**The One File Rule.** A colour value is written only in `app/globals.css`.
No `oklch()`, hex or `rgb()` inline in a component. One inline colour breaks a
theme. The one exception `CLAUDE.md` allows is email templates in
`supabase/templates/`, which copy sRGB hex from the tokens. The map's
`--map-accent` is sRGB because MapLibre cannot read oklch, but it still lives
in `globals.css`. **Known breach:** the `theme-color` meta tag in
`app/layout.tsx` writes `#14120E` inline and does not swap with the theme.

**The One Voice Rule.** Sage marks the single next action on a screen. Two sage
buttons side by side means one of them should be quiet.

**The Warm Black Rule.** The field is never neutral black (`#000`) or a cool
grey. The warmth is the identity.

## Typography

**Display Font:** Fraunces (with Georgia, serif), weights 600 and 700 loaded.
**Body Font:** Inter (with system-ui, sans-serif), weights 400–700 loaded.

**Character:** A soft, slightly old-fashioned serif for headings gives warmth
and a human voice; a neutral, highly legible sans carries every label, field
and paragraph so the app stays easy to read at night on a small screen.

### Hierarchy
- **Display** (Fraunces 600, 1.875rem, 2.25rem line, −0.02em): the one page
  heading, `h1`.
- **Headline** (Fraunces 600, 1.25rem, 1.75rem line, −0.02em): section
  headings.
- **Title** (Fraunces 600, 1.125rem, 1.75rem line, −0.02em): card headings.
- **Body** (Inter 400, 0.875rem, 1.25rem line): most text in the app. The
  app is small-text and dense by default.
- **Input** (Inter 400, 1rem, 1.5rem line): text typed into a field. Never
  smaller — iOS zooms the page on focus below 16px.
- **Label** (Inter 500, 0.875rem): field labels (in Dusk Ink) and button text
  (600).
- **Caption** (Inter 400, 0.75rem, 1rem line): timestamps and fine print.

### Named Rules

**The Serif Is For Headings Rule.** `h1`–`h3` get Fraunces from `globals.css`.
Nothing else does — not buttons, not labels, not numbers.

**The Sixteen Pixel Rule.** Every text field uses 1rem type.

## Layout

A single phone-width column. Most pages are `max-w-md` (28rem) centred —
a few short forms use `max-w-sm` (24rem) — with
16px side padding and 40px top padding. Content stacks vertically with gaps of
8, 12, 16 or 24px; 24px separates page sections. The admin area alone widens
to `max-w-5xl`.

Spacing follows Tailwind's 4px grid. There is no custom breakpoint yet; wide
screens show the same column centred. The spec's **Mobile** section is the
contract for small screens: 375px base width, 44px tap targets, thumb reach,
safe areas, no sideways scroll, and the keyboard never hides the focused field
or its submit.

Filter chips scroll sideways inside their own row; the page never does.

## Elevation & Depth

Flat. No `box-shadow` anywhere in the app. Depth is tonal: Warm Night is the
floor, Ember Card sits one step up, Ember Raised one more. A card inside a card
steps up again rather than casting a shadow.

### Named Rules

**The No Shadow Rule.** Lift a surface by making it a shade lighter, never by
adding a shadow. Shadows on a warm-black field read as muddy.

## Shapes

Generously rounded, never sharp and never pill-shaped by default.

- **Controls** — buttons, inputs, chips, selects, the toggle: 0.875rem (14px).
- **Cards** — panels, notices, list items: 1.125rem (18px).
- **Full circle** only for things that are round by nature (a camera shutter,
  an avatar).

Borders are 1px Charred Rule, and only on fields. Cards have no border; their
tone separates them from the field.

## Components

### Buttons
Full-width, calm and confident.
- **Shape:** control radius (14px), full width by default.
- **Primary:** Sage fill, On Sage text, Inter 600 at 0.875rem, 12px × 16px
  padding.
- **Quiet:** Ember Raised fill, Cream Ink text. For every action that is not
  the one next step.
- **Hover:** Sage → Sage Pressed; Quiet → Charred Rule. Colour transition only.
- **Disabled:** 50% opacity.
- **Text link:** underlined, Dusk Ink or Sage, for low-weight actions such as
  "Sign out".

### Chips
- **Style:** Ember Raised fill, Cream Ink text, control radius, 8px × 12px.
- **Selected:** Sage fill, On Sage text, marked `aria-current`.
- Used for feed type filters and the List / Map switch. A chip is a link, so
  a filtered feed is a URL.

### Cards / Containers
- **Corner Style:** card radius (18px).
- **Background:** Ember Card; Ember Raised when nested.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none.
- **Internal Padding:** 16px (12px when nested).
- **Notice cards** reuse the card with the text colour carrying the tone:
  Honey for a warning or change, Cream Ink for information, Clay for an error.

### Inputs / Fields
- **Style:** Ember Card fill, 1px Charred Rule border, control radius, 12px ×
  16px padding, 1rem Cream Ink text, Dusk Ink placeholder.
- **Label:** above the field, 0.875rem Inter 500 in Dusk Ink, tied by `useId`.
- **Focus:** the border turns Sage; no outline, no glow.
- **Password:** a 48px show/hide eye button inside the right edge; the
  browser's own reveal eye is hidden.
- **Checkbox:** 20px, Sage accent, label clickable.

### Theme toggle
A segmented control: an Ember Raised track with 4px padding holding Dark,
Light and System. The chosen segment is a Sage fill with On Sage text.

### Navigation
Not yet built. Plan 04b adds the **Frame**: a thin header and, on a phone, a
bottom tab bar (Seshes, My seshes, New, Me). The shape brief in
`.impeccable/surfaces/route-me.md` sets its structure; it must be built from the tokens
above.

## Do's and Don'ts

### Do:
- **Do** use token classes (`bg-surface`, `text-ink`, `bg-primary`) for every
  colour.
- **Do** keep one Sage action per screen; make the rest Quiet.
- **Do** step surfaces lighter (Warm Night → Ember Card → Ember Raised) to show
  depth.
- **Do** use 1rem type in every field.
- **Do** check both themes; light is a full theme.
- **Do** add a visible `:focus-visible` treatment when you touch a button or
  link. Fields turn their border Sage on focus; buttons and links today rely
  on the browser default outline, which is a known gap.

### Don't:
- **Don't** write `oklch()`, hex or `rgb()` in a component.
- **Don't** add a box-shadow.
- **Don't** use neutral black, cool grey, neon green or hot green.
- **Don't** use Fraunces for anything but headings.
- **Don't** use Honey as a button fill.
- **Don't** use cannabis imagery or leaf icons as decoration. The logo's
  leaf-eyes are the one exception, and they are meant to read as a smile first.
- **Don't** propose a new look here. The beauty pass is Plan 08, and it keeps
  Warm Ink.
