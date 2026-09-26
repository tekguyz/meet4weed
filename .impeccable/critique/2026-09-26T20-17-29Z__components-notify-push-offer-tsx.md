---
target: push card and notifications settings
total_score: 22
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Projects\\meet4weed\\components\\notify\\push-offer.tsx"
target_fingerprint: "sha256:7d6101034d52e43760a55b0cc3316aa784b999dd7156c4a66e371f68abbda2d1"
target_path: "C:\\Projects\\meet4weed\\components\\notify\\push-offer.tsx"
timestamp: 2026-09-26T20-17-29Z
slug: components-notify-push-offer-tsx
---
Method: dual-agent (A: design review, B: detector). Browser overlay skipped: pane notification permission is "denied", so the card cannot render.

Score 22/36 (heuristic 7 n/a: one-time opt-in).
1 Status 2 — silent failure on save; up to 10s busy wait.
2 Real world 3 — "browser's settings" wrong for installed PWA.
3 Control 3 — "Not now"/"Got it" permanent, no pointer to Settings.
4 Consistency 2 — "Turning on…" vs "One moment…".
5 Error prevention 3 — prompt only from button press (strong).
6 Recognition 3 — blocked state has no path.
8 Minimalist 3 — iOS variant says "Turn on" with no Turn on button.
9 Error recovery 1 — failed save returns "off" silently.
10 Help 2 — blocked state has no steps.

Detector: 0 findings in push-offer.tsx, push-setting.tsx, notifications/page.tsx, settings-list.tsx.

Priority issues:
P1 Silent failure on save/timeout — add "failed" state + danger Banner. (/impeccable harden)
P1 iOS variant contradicts itself; "Got it" hides forever — own copy, separate dismiss. (/impeccable clarify)
P2 Blocked copy generic, dead end — Android steps; re-read state on visibilitychange. (/impeccable clarify)
P2 No hierarchy between Turn on / Not now — Not now as text link + "turn on later in Settings". (/impeccable polish)
P2 Layout shift on /seshes/mine — decide synchronously or mount below lists. (/impeccable harden)

Minor: no success confirmation; Settings status as Banner reads as alert; "Saved on this device" half true; card at bottom of sesh page.
