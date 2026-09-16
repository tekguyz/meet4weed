# TEKGUYZ Knowledge Base: Meet4Weed (Beta)
**Document Type:** Internal Engineering & Product Reference  
**Project Identifier:** `meet4weed-beta`  
**Current Version:** `0.0.0` (Prototype / Beta)  
**Author / Publisher:** TEKGUYZ Internal Engineering  
**Last Verified:** September 2026  

---

## 1. Executive Summary & Purpose

### 1.1 What Problem It Solves
Medical marijuana cardholders in Florida (regulated by the Florida Office of Medical Marijuana Use / OMMU) lack dedicated, legal-compliance-conscious spaces to organize private social gatherings ("sessions") and connect with other legitimate patients. General social networks restrict cannabis-related gatherings, lack verification mechanisms to ensure all participants are legal cardholders, and do not cater to patient strain preferences or consumption styles.

### 1.2 Why It Was Built
Meet4Weed was conceived as an exclusive, verified private community web app for Florida medical cannabis patients to:
1. Ensure a legal, safe, and vetted membership base using AI card verification.
2. Provide a specialized session discovery and hosting system tailored to cannabis culture (strains on deck, consumption methods, vibes).
3. Foster peer connections ("crews") and 1-on-1 private messaging without risking account suspensions on mainstream platforms.

### 1.3 What It Actually Does (Current Implementation Reality)
In its current codebase, Meet4Weed is a **single-page frontend client prototype (React 19 + TypeScript + Vite)** running entirely on mock in-memory state:
- A feed of private sessions with filtering by event category and keyword search.
- Event details with RSVP management, host controls (edit/cancel), location copying, Google Maps links, and community strain contributions ("Strains on Deck").
- A mock 1-on-1 messaging view with pre-populated message threads and simulated real-time text input.
- User profile viewing, editing (bio, location, preferred strains, consumption methods), and a preference-matching score algorithm ("Vibe Matches").
- An in-memory notification center handling RSVPs, event updates, cancellations, crew invites, and automated 24-hour session reminders.
- A 3-step registration wizard featuring an automated medical card verification interface designed to call an AI verification endpoint.

---

## 2. Key Features

### 2.1 Medical Card Verification (Sign-Up Wizard)
- **Workflow:**
  1. Step 1: User provides `Username`, `Email`, and `Password`.
  2. Step 2: User inputs `Patient ID #`, `Card Expiry Date`, and uploads a photo of their Florida OMMU card.
  3. Step 3: Frontend encodes image to Base64 and invokes `verifyMedicalCardImage()` in `src/services/geminiService.ts`.
  4. Backend handler (`netlify/functions/verify-card.ts`) uses Gemini (`gemini-2.5-flash`) with structured schema output (`isVerified: boolean`, `reason: string`) to inspect the card seal, layout, patient ID match, and expiration date match.

### 2.2 Session Discovery & Management (`Home.tsx`, `EventDetails.tsx`, `EventEditorModal.tsx`)
- **Feed & Filters:** Filters events by `EventType` (`Chill & Relax`, `Creative Sesh`, `Game Night`, `Outdoor Adventure`, `Music & Vibes`, or `All`) and real-time substring search on session titles and descriptions.
- **Session Details:** Displays host information, date/time, location with Google Maps deep link (`https://www.google.com/maps/search/?api=1&query=...`), copy-to-clipboard button, attendee list, and strain contributions.
- **RSVP & Strain Contribution Flow:** 
  - Clicking RSVP presents a modal asking if the attendee will contribute a strain.
  - If yes, opens `AddStrainModal` to log strain name and type (`Indica`, `Sativa`, `Hybrid`).
  - Users can remove their own strain contributions; hosts can manage the full event.
- **Host CRUD:** Hosts can edit session details or cancel the session with a confirmation modal, which dispatches notifications to all confirmed attendees.

### 2.3 Direct Messaging (`Messaging.tsx`)
- Master-detail chat interface (responsive: collapses to list or chat window on small screens).
- Displays message threads sorted by latest activity.
- Client-side message sending appends to the active conversation state.

### 2.4 Profile & "Vibe Matching" (`Profile.tsx`, `UserProfile.tsx`)
- **Profile Customization:** Users configure bio, location, preferred strain types (`Indica`, `Sativa`, `Hybrid`, `Any`), and consumption methods (`Flower`, `Vape`, `Edibles`, `Dabs`, `Any`).
- **Matching Algorithm:** On `UserProfile.tsx`, computes a match score between the selected user and all other registered users based on shared strain preferences + shared consumption methods. Top matches are displayed with a "X vibes in common" badge.
- **Crew Network:** Users can send crew invites to other members from their profile, which generate actionable notifications for the recipient.

### 2.5 Notification Dispatcher (`NotificationsPanel.tsx`, `AppContext.tsx`)
- Supports 6 notification types: `NEW_RSVP`, `EVENT_REMINDER`, `CREW_INVITE`, `EVENT_INVITE`, `EVENT_UPDATED`, `EVENT_CANCELLED`.
- Automated 24-hour reminder: When a user logs in, a `useEffect` detects any upcoming sessions within 24 hours and automatically adds an unread `EVENT_REMINDER`.
- Crew invitations include an inline "Accept" button that updates mutual crew lists for both users.

---

## 3. Technology Stack & Dependencies

### 3.1 Core Architecture
| Layer | Technology | Specification / Package | Notes |
| :--- | :--- | :--- | :--- |
| **Framework** | React | `^19.1.1` | Modern React root rendering (`createRoot`) |
| **DOM Engine** | React DOM | `^19.1.1` | Standard web runtime |
| **Language** | TypeScript | `~5.8.2` | Target: ES2022, strict type checks enabled in `tsconfig.json` |
| **Bundler / Dev Server** | Vite | `^6.2.0` | Configured to bind on `0.0.0.0:3000` |
| **Styling** | Tailwind CSS CDN | `https://cdn.tailwindcss.com` | Script-injected in `index.html` with custom runtime config |
| **CSS Utilities** | `clsx` & `tailwind-merge` | `clsx@^2.1.1`, `tailwind-merge@^3.3.1` | Combined in `src/lib/utils.ts` (`cn()` helper) |
| **AI Integration** | Google GenAI SDK | `@google/genai@^1.20.0` | `gemini-2.5-flash` model target |
| **Serverless Function** | Netlify Functions | `@netlify/functions@^4.2.6` | `netlify/functions/verify-card.ts` |
| **Icons** | Custom SVGs | `src/components/icons/index.tsx` | Handcrafted Feather/Lucide-style SVG wrappers |

### 3.2 Typography & Visual System
- **Font:** Google Fonts `Fira Code` (weights 300, 400, 500, 600, 700).
- **Color Palette:**
  - `brand-primary`: `#39FF14` (Fluorescent Neon Green)
  - `brand-secondary`: `#40C0E7` (Electric Cyan)
  - `dark-bg`: `#0D0D0D` (Near Black canvas)
  - `dark-surface`: `#1A1A1A` (Container surface)
  - `dark-text`: `#E0E0E0` (Off-white body text)
- **Glow Effects:** Custom box shadows `glow-primary` (`rgba(57, 255, 20, 0.5)`) and `glow-secondary` (`rgba(64, 192, 231, 0.5)`).
- **Branding:** `MadeByTekguyz` badge fixed at bottom-right linking to `https://tekguyz.com?ref=made-by-tekguyz`.

---

## 4. Current Build & Compilation Status

- **`npm run build` (`vite build`):** **PASSING / GREEN**.
- **Dev Server:** Port `3000` on host `0.0.0.0`.
- **Packaging:** Valid `package.json` with ESM modules (`"type": "module"`).

---

## 5. Architectural & Implementation Flagging (Code vs. Docs Contradictions)

This section highlights exact discrepancies between repository documentation (e.g. `README.md`, comments) and the reality of the code:

### 🚩 Discrepancy 1: Serverless Verification Function vs. Local Vite Dev Environment
- **What README / Docs State:**  
  `README.md` states: *"Utilizes Google's Gemini API to securely verify every member's Florida OMMU card"* and lists environment variable `API_KEY` for `process.env.API_KEY`.
- **What Code Does:**  
  - `src/services/geminiService.ts` makes an absolute HTTP POST call to `/.netlify/functions/verify-card`.
  - The function is written in `netlify/functions/verify-card.ts`.
  - **However:** `netlify.toml` is completely empty (0 bytes), `_redirects` is empty (0 bytes), and `vite.config.ts` does not proxy `/.netlify/functions/*` to any serverless emulator.
  - **Impact:** In the standard Vite dev environment (`npm run dev`), submitting the card verification form sends a request to Vite's dev server at `http://localhost:3000/.netlify/functions/verify-card`, which returns an HTML fallback or 404. Unless deployed to Netlify with Netlify CLI running functions, card verification fails at runtime.

### 🚩 Discrepancy 2: Missing `Buddies.tsx` View
- **What README / Specs State:**  
  `README.md` lists *"Vibe Matches: Discover other users with similar preferences and build your trusted crew"* as a key feature. The file tree includes `/src/views/Buddies.tsx`.
- **What Code Does:**  
  - `/src/views/Buddies.tsx` is completely empty (0 bytes).
  - It is not declared in `Page` enum (`src/types.ts`), nor imported in `App.tsx` or `BottomNavBar.tsx`.
  - The "Vibe Matches" functionality was instead partially implemented directly inside `/src/views/UserProfile.tsx` (lines 12–38).

### 🚩 Discrepancy 3: Tailwind CSS Build Pipeline Contradiction
- **What README / Dependencies State:**  
  The documentation describes Tailwind CSS as part of the frontend build stack.
- **What Code Does:**  
  - `tailwindcss` is **not** installed in `package.json` (neither under `dependencies` nor `devDependencies`). There is no PostCSS configuration or `@tailwindcss/vite` plugin in `vite.config.ts`.
  - Instead, styling relies on a runtime CDN script in `index.html`:  
    `<script src="https://cdn.tailwindcss.com"></script>`
  - Additionally, `index.html` line 90 includes `<link rel="stylesheet" href="/index.css">`, but no `index.css` or `/src/index.css` file exists in the repository (browser receives a 404 for this file).

### 🚩 Discrepancy 4: Duplicate React Root Mounting Scripts
- **What Code Does:**  
  In `index.html`:
  - Line 94: `<script type="module" src="/src/index.tsx"></script>`
  - Line 95: `<script type="module" src="/index.tsx"></script>`
  Both `/src/index.tsx` and `/index.tsx` exist in the filesystem, and both execute `ReactDOM.createRoot(rootElement).render(...)`. This mounts the root React tree twice in development.

### 🚩 Discrepancy 5: Unimplemented Google Sign-In
- **What Code Does:**  
  In `src/views/Login.tsx`, a `<GoogleSignInButton />` is rendered with Google SVG iconography, but it contains no `onClick` handler and has an inline comment:  
  `{/* Note: This is a visual representation. Netlify Identity/Auth0 would be needed for full functionality. */}`.

### 🚩 Discrepancy 6: Absence of Data Persistence
- **What Code Does:**  
  All entities (`USERS`, `EVENTS`, `MESSAGES`, `CONVERSATIONS`, `NOTIFICATIONS`) are held solely in React component state inside `AppContext.tsx`, initialized from `constants.ts`. There is no Firestore, LocalStorage, IndexedDB, or REST API persistence. Browser reloads reset all modifications (RSVPs, newly created events, messages, profile edits).

### 🚩 Discrepancy 7: Demo Authentication Bypass
- **What Code Does:**  
  Login validation in `AppContext.tsx` (lines 133–145) only tests:
  ```typescript
  const user = users.find(u => u.email === email);
  if (user && pass === 'password') { ... }
  ```
  Any account in `constants.ts` can be accessed using password `"password"`. The "Try Demo" button logs into `ryder@example.com` automatically.

---

## 6. Directory & File Reference Map

```
/
├── index.html                   # Entry HTML; loads Tailwind CDN, Fira Code font, dual root scripts
├── index.tsx                    # Root entry point #1 (imports from ./src)
├── metadata.json                # Project metadata ("Meet4Weed Beta")
├── netlify.toml                 # Netlify configuration (Currently empty, 0 bytes)
├── _redirects                   # Netlify redirects (Currently empty, 0 bytes)
├── package.json                 # Project dependencies & build scripts
├── tsconfig.json                # TypeScript compiler configuration (ES2022, bundler module resolution)
├── vite.config.ts               # Vite configuration (Port 3000, 0.0.0.0, API_KEY defines)
├── netlify/
│   └── functions/
│       └── verify-card.ts       # Serverless function calling Gemini API for OMMU card verification
└── src/
    ├── App.tsx                  # App frame, Header, BottomNavBar, Routing switcher, HowItWorksModal
    ├── constants.ts             # Mock seed data (8 users, 7 events, 23 messages, 5 conversations)
    ├── index.tsx                # Root entry point #2 (imports from ./App)
    ├── types.ts                 # Core TS interfaces (User, Event, Message, Conversation, Notification)
    ├── components/
    │   ├── BottomNavBar.tsx     # Mobile bottom navigation bar (Sessions, Chats, Profile)
    │   ├── EventCard.tsx        # Card display for session preview in home feed
    │   ├── EventEditorModal.tsx # Modal form for creating and updating sessions
    │   ├── Footer.tsx           # Footer with copyright and TEKGUYZ badge
    │   ├── Header.tsx           # Top navigation bar with logo, title, back button, notifications bell
    │   ├── InviteModal.tsx      # Modal to search and invite other users to sessions
    │   ├── Logo.tsx             # Brand logo with text
    │   ├── Logomark.tsx         # SVG logomark
    │   ├── MadeByTekguyzBadge.tsx # Official TEKGUYZ branded floating attribution badge
    │   ├── MiniUserCard.tsx     # Compact user preview used in vibe match recommendations
    │   ├── NotificationsPanel.tsx # Dropdown notifications list with read/unread & action triggers
    │   ├── UserCard.tsx         # User card component
    │   ├── icons/index.tsx      # Custom SVG icon library
    │   └── ui/                  # Reusable UI primitives (Button, Modal, Input, Toast, SkeletonCard, StrainPill)
    ├── context/
    │   └── AppContext.tsx       # Global state provider (Users, Events, Auth, Messaging, Notifications)
    ├── lib/
    │   └── utils.ts             # Tailwind class merging utility (`cn`)
    ├── services/
    │   └── geminiService.ts     # Client-side verification function calling `/.netlify/functions/verify-card`
    └── views/
        ├── Buddies.tsx          # Stub file (0 bytes, unused)
        ├── EventDetails.tsx     # Session detail view, RSVPs, map link, strain contributions, host actions
        ├── Home.tsx             # Session feed, category filter bar, search input, "Start Sesh" FAB
        ├── Login.tsx            # Landing page, demo login, feature cards, sign-up verification wizard
        ├── Messaging.tsx        # Direct messaging layout and active chat window
        ├── NotFound.tsx         # 404 "Vibe Not Found" fallback screen
        ├── Profile.tsx          # Current user's profile view and "My Vibe" editor
        └── UserProfile.tsx      # Other members' profile view with "Vibe Matches" algorithm calculation
```

---

## 7. Recommended Engineering Roadmap (To Reach Production Grade)

1. **Unify Entry Points:** Remove duplicate `<script>` and `index.tsx` file to prevent double-mounting React roots.
2. **Backend / Function Proxying:** Configure either a local Express server proxy or Netlify CLI configuration (`netlify.toml` with `functions = "netlify/functions"`) so that `verify-card.ts` can be developed and tested locally.
3. **Persistent Datastore:** Replace in-memory `AppContext` states with durable cloud persistence (such as Firebase Firestore or Supabase) with rules securing private user data and medical documents.
4. **Remove Unused Stubs:** Either implement `Buddies.tsx` as a dedicated crew-discovery view or clean it from the codebase.
5. **Install Local Tailwind Pipeline:** Replace runtime CDN `<script src="https://cdn.tailwindcss.com">` with compiled Tailwind CSS (Tailwind v3 or v4 with Vite plugin) to eliminate external script blocking and ensure offline build reproducibility.
6. **Authentication Engine:** Replace `'password'` mock check with Firebase Auth, Supabase Auth, or Netlify Identity.
