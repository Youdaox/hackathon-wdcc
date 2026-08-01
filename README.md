# Incline

**WDCC x SESA Hackathon 2026** — Youdao Xing, Jason Lim, Ethan Siao, Catherine Luo, Jonas Liwanag, Nicholas Torres, Cylia Niu

A companion creature that only grows on **verified, undistracted study time**, tied to your real class schedule.

```bash
npm run dev     # http://localhost:3000

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

## Structure

```
src/app/api/      recall route handler (the only server-side code)
src/lib/          types, storage, time/schedule helpers, growth rules, zones,
                  recall questions, store (context)
src/hooks/        useFocusSession (the verification engine), useGeolocation,
                  useRecallCheck, useNow
src/components/   FocusPanel, SchedulePanel, CompanionCard, TodaySummary,
                  LocationCard, RecallCheck, SessionSummary
```

## Not built yet

- **Canvas import** — `StudyBlock` already carries `source` and `externalId`; see the data model above.
