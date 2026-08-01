# Incline — Updated Plan (What's Left to Build)

Revised against the actual state of `hackathon-wdcc`. Everything already implemented has been cut from the plan below; what remains is the real to-do list.

## 1. Product summary (unchanged)

A study companion app with a virtual pet that only grows through verified, undistracted focus time. Reads Canvas/Calendar for study blocks.

**Correction to the original framing:** the plan assumed app-blocking was out of scope entirely ("unreliable on iOS without special Apple approval") and leaned fully on an honesty checkpoint instead. That's no longer accurate — a real native Android blocker already exists (`mobile/modules/app-blocker`, Kotlin, usage-access + overlay permissions, custom dev client build). The honest-checkpoint mechanic and the blocker aren't alternatives anymore; they're two layers, Android gets both, iOS gets checkpoint-only. Keep that distinction in the pitch.

## 2. Already built — do not rebuild

- **Session engine** (`mobile/src/useFocusSession.ts`): start/stop, `AppState`-based exit detection, timestamp-accounted focused/distracted ms, grace period for sub-5s blips. Ported 1:1 from the web app's visibility-based version.
- **Native Android app blocker** (`mobile/modules/app-blocker`): usage-access + overlay permission flow, installed-app picker, block screen with bypass tracking, `useAppBlocker.ts` hook wiring it all together. Android + dev-client only — correctly reports `supported: false` on Expo Go/iOS.
- **Location check-in** (`mobile/src/location.ts`): single fix via `expo-location`, haversine distance, nearest/active spot matching against multiple study spots (not just one hardcoded point — the server drives a `study-spots` list with per-spot multipliers).
- **Backend contract**: `/api/sessions`, `/api/distraction-events`, `/api/distraction-list`, `/api/companion`, `/api/study-spots`, plus extras not in the original scope at all — `/api/leaderboards` (+ rules), `/api/encouragements` (+ balance), `/api/canvas/session`, `/api/tasks/complete`, `/api/recall`. Mobile already talks to all of the core ones (`mobile/src/api.ts`).
- **Pet growth/mood model** (`src/lib/companion.ts`): XP per focused minute, level curve, HP drain per distraction, HP regen per focus, idle-day decay, mood tiers (happy/neutral/sad/sick) with a `Sprout` component rendering it (mobile) and matching web version.
- **Screens**: Home (companion + metrics + location + focus panel), Settings (app picker + permission prompts), Recap (weekly chart), Ranks (leaderboard) — all built with real navigation (`BottomNav`), just some using placeholder data (see below).
- **Recall check** (web, `RecallCheck.tsx` / `useRecallCheck.ts`): a mid-session quiz nudge for bonus XP — an extra retention mechanic beyond anything in the original plan.
- **Web focus tracking**: gaze/face-pose verification via MediaPipe/WebGazer (`facePose.ts`, `gaze.ts`, `GazeCalibration.tsx`) — the web MVP's focus verification is well beyond Page Visibility API alone; it's actually checking attention, not just tab focus.

## 3. Still to build

### 3.1 The actual honesty checkpoint UI (highest priority — this is the core mechanic and it's the one piece missing)
`useFocusSession` already detects and times every "away" stretch and pushes it into `distractions[]`, but nothing surfaces to the user on return. Needed:
- Full-screen check-in modal on return from background, framed as the pet talking.
- Guess-first flow: ask "how long do you think you were gone?" before revealing the real number.
- Reason picker (emergency / needed for task / distraction / end session) with the differentiated consequences described in the original plan (no penalty / logged note / sad-state + distracted-minutes bump / session end).
- Wire the chosen reason back into the distraction record so it reaches `/api/distraction-events` and `/api/sessions` (the payload shape already supports arbitrary reasons — only the client-side capture is missing).

### 3.2 Recap screen: replace placeholder data
`RecapScreen.tsx`'s weekly chart and "5 of 7 study days" goal are hardcoded (`WEEK` constant, static goal count). Needs to pull real per-day focus/distraction totals and streak data from the backend once sessions have been logged with reasons.

### 3.3 Ambient layer A (notifications / live status)
Not started — no `expo-notifications` dependency yet. Add: local push notification showing session status while backgrounded (needs custom dev client, not Expo Go). Web tab-title countdown is also not implemented.

### 3.4 Ambient layer B (native widget/Live Activity) — stretch, unchanged
Still fully unbuilt and still explicitly optional. `expo prebuild` + `@bacons/apple-targets` config plugin, EAS Build free tier, free Apple ID sideload, ~7-day re-sign cadence. Only attempt after 3.1–3.3 are solid.

## 4. Revised build order

1. Checkpoint UI (guess → reveal → reason picker → consequence) — the one gap in the "guaranteed demo" path.
2. Wire checkpoint reasons into the existing event payload and recap data.
3. Replace Recap screen placeholder data with real aggregation.
4. Ambient layer A (notifications, tab title).
5. (Stretch) Ambient layer B — native widget.

Steps 1–3 close out the guaranteed demo. Everything else (session engine, blocker, location, growth model, backend, base screens) is already done.

## 5. Free demo path — unchanged, still accurate

Expo Go covers the checkpoint/growth/location/backend-sync loop with zero signing steps. The native Android blocker and any future widget/Live Activity work require a custom dev client via EAS Build free tier + a free Apple ID for sideloading — no paid developer account, no App Store submission. Same guidance as before on what not to spend time on (App Store, TestFlight, paid dev account, continuous location, Screen Time/FamilyControls entitlements) still holds, except app-blocking itself is no longer "cut from scope" — it's built for Android and intentionally absent on iOS.
