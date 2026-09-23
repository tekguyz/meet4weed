---
version: 1
slug: "route-me"
primary_target: "route:/me"
related_targets: ["route:/me/settings","route:/seshes","route:/seshes/mine","route:/seshes/new"]
---

# Shape brief: the Frame and the Me / settings tree

Plan 04b (#59), written in ticket #60 on 2026-09-23. Confirmed with the owner:
settings is a list of sub-pages; the phone header shows the page title and the
bell. Everything else comes from #59 and spec §5, §7 and the Mobile section.
No code, no visual world: the look is Warm Ink, recorded in `DESIGN.md`.
Plan 08 owns the beauty pass. This brief owns structure.

## 1. Job and audience

- **Who:** a verified member on their phone, usually the installed PWA,
  often at night. Also: a member whose card gate is shut (pending, rejected,
  retake, expired, unverified) and the owner as admin.
- **Mode:** Operate. Scanability, sameness from page to page and native phone
  habits beat expression.
- **The job of the Frame:** always show where I am and let me reach the four
  places with one thumb, without the browser's back button.
- **The job of Me:** show where I stand (card status, expiry) and let me change
  anything about my account.

## 2. Outcome and proof

- Success: every signed-in page has the same four tabs in the same order, and
  no page is a dead end.
- Success on Me: a member sees their avatar, handle, card status and expiry in
  one glance, and reaches any setting in two taps.
- Product truth to carry: hidden tabs are **hidden, not greyed**; the admin
  link appears for admins only and nowhere else; a profile never lists seshes;
  no photo avatar.

## 3. Selected direction

- **Visual authority:** Warm Ink as recorded in `DESIGN.md`. Tokens only.
  Flat, tonal depth, control and card radii. No new look.
- **Structural thesis:** a native-feeling phone app. Bottom tab bar for the
  four places; a thin header that names the page; settings as a grouped list
  that drills into one small page per job, like iOS Settings.
- **Focal moment on Me:** the where-you-stand card at the top — avatar, handle, card
  status, expiry. It is the one hero card on the screen.
- **Implementation consequence:** one Frame layout wraps signed-in routes. The
  access model (a pure function in the member gate module) decides which tabs
  show and where `/` goes. The Frame renders the answer and decides nothing.

## 4. Scope and boundaries

- **In:** the Frame (header + bottom bar + wide-screen header nav), `/me`,
  `/me/settings` and its sub-pages, held rows for Plan 05 and Plan 06.
- **Out:** the bell's contents (Plan 05), blocked members (Plan 06), the
  beauty pass (Plan 08), the where-you-stand card's copy (its own ticket).
- **Untouched:** Warm Ink tokens, `app/globals.css` values, the admin area's
  own layout (it keeps "Back to app").
- **Anti-goals:** a hamburger menu; greyed-out tabs; a floating action button;
  a toast; a settings page that is one long form; any sesh list on a profile.

## 5. States and ranges

- **Tabs by access:** `full` → Seshes, My seshes, New, Me. `read_only` →
  Seshes, My seshes, Me. `pending`, `unverified`, `suspended` → Me only. A
  bar with one tab still shows, so the member always sees where Me is.
- **Admin:** an "Admin" row inside Me. Never a tab.
- **Handles:** 3 to 20 characters; a long handle truncates with an ellipsis in
  the header and the where-you-stand card, and wraps nowhere.
- **Card status on Me:** verified (with expiry date), expiring within 30 days
  (Honey notice + Renew), expired (read-only explained + Renew), pending,
  rejected, retake requested, unverified, suspended (says the account is
  suspended and gives the Help contact; no other action). Each links to its
  next step. Rejected and retake requested are not member statuses: they come
  from the latest verification's status (`lib/verification/status.ts`).
- **Settings save:** each sub-page shows the shared inline banner on success
  or error, next to the form. No toast.
- **Handle change:** can be refused as taken, locked, or too soon (once every
  30 days). The page says which, and when it can be tried again.
- **Held rows:** Notifications and Blocked members show in the list, marked
  "Coming soon", and do not open a page.
- **Loading:** the Frame stays put; only the page body shows the loading
  state.

## 6. Interaction and layout

**The Frame on a phone (below the wide breakpoint)**

- **Header:** thin, pinned top, clears the top safe area. Left: the page
  title, or a back arrow plus the title on a sub-page (settings sub-pages,
  a sesh, a profile). Right: the bell slot (empty until Plan 05; it keeps its
  space so the title does not jump when the bell arrives).
- **Bottom tab bar:** pinned bottom, clears the home-bar safe area. Tabs in
  this order: Seshes, My seshes, New, Me. Each tab is an icon over a short
  label, at least 44px tall, spread evenly across the width. The active tab is
  Sage and carries `aria-current="page"`; the others are Dusk Ink.
- **Page body:** scrolls between the two bars; padded so the last item never
  sits under the bottom bar.
- **Keyboard:** when the on-screen keyboard is open, the bottom bar may hide;
  the focused field and its submit must stay in view.

**The Frame on a wide screen**

- No bottom bar. The same four items sit in the header, right of the
  wordmark, in the same order, with the bell at the far right. The page body
  stays a centred column; it does not stretch.

**Accessibility**

- A "Skip to content" link is the first focusable element.
- The tab bar (or the header nav on a wide screen) is a `nav` landmark labelled
  "Main". The header is a `header` landmark; the page body is `main`.
- Every tab has a visible label; icons are decorative.
- Focus is visible on every tab and row.

**Me (`/me`)**

1. **Where-you-stand card** (the hero; the `CONTEXT.md` term): avatar, display name, @handle, card status
   and expiry. A notice line in the card when the card expires soon or has
   expired, with a Renew button.
2. **"See your profile"** — opens `/m/[handle]`, as others see it.
3. **A grouped list** of rows, each 44px or more, each a full-width tap
   target with a chevron:
   - Settings
   - Help · Terms · Privacy · Community rules
   - Admin (admins only)
4. **Sign out** as a quiet button near the bottom.
5. **About** line at the very bottom: the app version, in caption type.

**Settings (`/me/settings`)** — a grouped list; each row opens one page.

- **Profile:** Edit profile (display name, bio, city, strain preferences,
  consumption methods, vibe tags) · Handle · Avatar
- **Appearance:** Theme (Dark, Light, System — the existing toggle moves here)
- **Account:** Password · Sessions (Sign out, Sign out everywhere)
- **Coming soon:** Notifications (Plan 05) · Blocked members (Plan 06)
- **Leave:** Delete account, in Clay, last and apart from the rest

**Each settings sub-page**

- One job, one form, one Sage submit. The submit sits right after the last
  field, so it stays within thumb reach and above the keyboard.
- **Avatar:** a large preview and a Shuffle button (Quiet), then Save (Sage).
- **Delete account:** says what is deleted and that it happens at once, that
  hosted future seshes are cancelled, and that coming back means verifying
  again. Password field, then a Clay "Delete my account" button. No second
  confirm dialog: the password is the confirmation.

## 7. Constraints and open decisions

- **Binding:** WCAG 2.2 AA; the spec's Mobile section (375px base, 44px taps,
  thumb reach, safe areas, no sideways scroll, keyboard never hides the
  focused field or its submit); tokens only; Next.js 16 App Router.
- **Reuse:** `Button` (primary, quiet), `Input`, `Textarea`, `Select`,
  `Checkbox`, `PasswordInput`, `ThemeToggle`, the profile form fields from
  onboarding, the new-password form from `/auth`.
- **For the builder to decide, within these rules:** the wide breakpoint
  (the Tailwind `md` step is the default); the tab icons (simple, line
  style, no leaf or cannabis icon); the exact route names of settings
  sub-pages.
- **Not for the builder to invent:** new colours, shadows, a second accent
  on the tab bar, a toast, a hamburger menu, extra tabs.
