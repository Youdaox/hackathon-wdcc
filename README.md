# Incline

**WDCC x SESA Hackathon 2026** — Youdao Xing, Jason Lim, Ethan Siao, Catherine Luo, Jonas Liwanag, Nicholas Torres, Cylia Niu

A companion creature that only grows on **verified, undistracted study time**, tied to your real class schedule.

```bash
pnpm install    # installs the web app and mobile/ in one pass
pnpm dev        # http://localhost:3000

cp .env.example .env.local   # optional — only needed for AI recall checks
```

## The mechanic

Focus is verified with the **Page Visibility API**. While a session runs, the tab being visible is the only time that earns XP. Switch tabs and the clock keeps running, but that time lands in the *distracted* bucket and your companion notices.

There's no blocking and no punishment — the cost is emotional, not punitive. The creature just wilts.

## Data model

Three collections in `localStorage`, defined in [`src/lib/types.ts`](src/lib/types.ts):

| Key | Shape | Notes |
| --- | --- | --- |
| `incline.schedule.v1` | `StudyBlock[]` | Weekly recurring blocks. Times are minutes-from-midnight; `days` is `0–6`. |
| `incline.companion.v1` | `Companion` | `level`, `xp` (toward current level), `hp` 0–100. Mood is *derived* from HP, never stored. |
| `incline.sessions.v1` | `FocusSession[]` | Completed sessions, newest first, capped at 200. |
| `incline.activeSession.v1` | live session | Written each tick so a refresh mid-session doesn't lose it. |
| `incline.geo.v1` | `boolean` | Location opt-in. We never prompt until this is true. |

`StudyBlock` carries `source: "manual" | "canvas"` and an optional `externalId`, so a real Canvas import can populate the same table later without a migration.

## Growth rules

All balance lives in `RULES` in [`src/lib/companion.ts`](src/lib/companion.ts):

- **1 XP** per verified focused minute
- Level *N* costs **30 × N** XP
- **−8 HP** per distraction, **+0.5 HP** per focused minute
- Hidden stretches under **5s** cost focus time but not HP (grace for accidental clicks)
- **−6 HP** per full day with no session (neglect decay, applied on load)

`applySession()` is pure — old companion in, new companion out — which makes the whole growth system one testable function.

## How the timing stays honest

Accounting is timestamp-based, not tick-based. Every flush moves *real elapsed time* into either `focusedMs` or `distractedMs`, and a flush happens on `visibilitychange` as well as on the 1s interval. This matters because browsers throttle timers in background tabs — a tick-counting implementation would badly under-report distraction, which is exactly the number that has to be trustworthy.

See [`src/hooks/useFocusSession.ts`](src/hooks/useFocusSession.ts).

## Location bonus

Three hardcoded campus zones in [`src/lib/zones.ts`](src/lib/zones.ts) grant an XP multiplier: General Library and Kate Edger at **1.5×**, Engineering at **1.25×**. Zone membership is a haversine distance check against a ~70m radius — generous on purpose, since indoor GPS is routinely 20–40m off and a false negative on stage is worse than a loose boundary.

**The rule:** whichever zone you're in when the session *ends* sets the multiplier, and it's shown live the whole time so there's no surprise at the end. Overlapping zones resolve to the highest multiplier.

Location is strictly additive:

- We never prompt until you press **Enable location bonus**.
- Denied, unsupported, or timed-out all resolve to "no reading" → **1×**, never an error state.
- Nothing about a focus session can be blocked by location.

Geolocation needs a secure context, so it works on `localhost` and over HTTPS — but *not* if you demo from a raw LAN IP like `http://172.20.10.67:3001`.

To recalibrate the coordinates on site: enable location and read the live lat/lng printed at the bottom of the Study spots card.

## AI recall checks

Once per session, at a random point after ~3 minutes of verified focus, one four-option question about the session's linked course appears in the corner. Right answer: **+10 XP**, flat (the location multiplier doesn't scale it). Skip or miss: nothing happens. The timer never stops and the card is one click to dismiss.

Multiple choice rather than free text is a deliberate call: it grades instantly with no second model call, and answering costs two seconds.

**The API key lives server-side.** [`/api/recall`](src/app/api/recall/route.ts) is a Next.js route handler that calls Claude with `ANTHROPIC_API_KEY` from the environment; the browser only ever POSTs a course name. Calling the Anthropic API directly from client JS would ship the key to every visitor.

Every failure path — no key configured, rate limit, network error, malformed response, model refusal — falls back to a built-in question labelled **offline** in the UI. So the feature demos without a key, and it never fakes a generated question.

Model: `claude-opus-5` with `effort: "low"` (it's one short question and the user is waiting) and structured outputs pinning the JSON shape, plus server-side validation of whatever comes back.

## Mobile app (Expo Go, SDK 54)

`mobile/` is an Expo Go app on SDK 54 (React Native 0.81.5). Two terminals:

```bash
pnpm dev -H 0.0.0.0            # repo root — backend on your LAN
cd mobile && pnpm start        # Expo, then scan the QR
```

Scan the QR with Expo Go. Set `expo.extra.apiBaseUrl` in [mobile/app.json](mobile/app.json) to your machine's LAN address — it's read at runtime, so changing it is a reload, not a rebuild.

**Use plain `http://` for the phone.** React Native's networking rejects the repo's self-signed dev cert outright, with no way to click through the way a browser does.

### Expo Go can't block apps

Expo Go is a fixed binary — you can't add native modules to it. That rules out `UsageStatsManager` and the overlay on Android, and the whole Screen Time family on iOS. There is no block screen and no "5 more minutes" bypass.

What remains is honest *detection*. React Native's `AppState` is the same signal as the web app's Page Visibility API: leave Incline and the clock keeps running, but that time stops earning XP. So the phone and the browser measure exactly the same thing, and [mobile/src/useFocusSession.ts](mobile/src/useFocusSession.ts) is a direct port of the web engine.

This also means the mobile client fits the existing contract with no changes: it posts `app_identifier: null` and `bypassed: false` — the case the server's penalty rule was already written for.

Timing is timestamp-based rather than tick-based, which matters more here than on the web: a backgrounded React Native app has its timers suspended outright, so counting ticks would under-report distraction to near zero.

## Mobile sync API

The Android and iOS companion apps sync against this app. Setup:

```bash
pnpm db:setup    # migrate + seed the campus study spots into incline.db
pnpm dev         # phones point at http://<your-lan-ip>:3000
```

SQLite via Drizzle, file-based at `incline.db` (override with `INCLINE_DB_PATH`). Venue wifi shouldn't sit between a phone and its own pet.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/companion?user_id=` | Current pet — level, xp, hp, derived mood |
| `POST /api/sessions` | Record a finished session, grow the companion, return `pet_growth_delta` |
| `POST /api/distraction-events` | Log one distraction live, mid-session |
| `GET /api/distraction-list?user_id=` | Android package names to watch (`PUT` to replace) |
| `GET /api/study-spots?user_id=` | Verified locations for the session-start check-in |

**Growth is computed server-side.** `POST /api/sessions` loads the companion, runs [`applySession()`](src/lib/companion.ts) — the same pure function the web app runs, imported not reimplemented — and returns the delta. Three clients each growing their own local pet would produce three different pets, and `pet_growth_delta` would just echo whatever the device already decided.

The server also refuses to take a client's word on two things: `verified_minutes` can't exceed the session's wall-clock length, and the location multiplier is re-read from `study_spots` rather than trusted from the payload.

Spots are seeded from `BONUS_ZONES` in [`src/lib/zones.ts`](src/lib/zones.ts), so all three platforms measure against the same building centres. Recalibrating on site means editing that file and re-running `db:setup`.

### The two distraction models

Android and iOS report genuinely different events under the same name, and [`src/lib/api/contract.ts`](src/lib/api/contract.ts) is the one place they're reconciled:

| | Web | Android | iOS |
| --- | --- | --- | --- |
| What "distraction" means | tab hidden | restricted app foregrounded | *a* restricted app opened |
| `app_identifier` | n/a | package name | **always null** — Apple never says which |
| `bypassed` | n/a | user tapped "5 more minutes" | always false — Apple owns the shield |

A distraction is penalised if **it was bypassed, or it lasted past the 5s grace window**. The second clause matters: without it iOS would be strictly easier than Android, since an iOS user *cannot* press bypass and would never lose HP at all.

### Not production-ready

There is no auth. `user_id` is any string the client sends, and user rows are created on first sight — so anyone can read or grow anyone's pet by guessing an id. Fine for a demo, and the first thing to fix if this ships.

## Structure

```
src/app/api/      recall + the four mobile sync route handlers
src/lib/db/       Drizzle schema and SQLite client
src/lib/api/      wire contract, validators, distraction adapter
src/lib/          types, storage, time/schedule helpers, growth rules, zones,
                  recall questions, store (context)
src/hooks/        useFocusSession (the verification engine), useGeolocation,
                  useRecallCheck, useNow
src/components/   FocusPanel, SchedulePanel, CompanionCard, TodaySummary,
                  LocationCard, RecallCheck, SessionSummary
```

## Not built yet

- **Canvas import** — `StudyBlock` already carries `source` and `externalId`; see the data model above.
