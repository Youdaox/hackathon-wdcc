# Incline

**WDCC x SESA Hackathon 2026** — Youdao Xing, Jason Lim, Ethan Siao, Catherine Luo, Jonas Liwanag, Nicholas Torres, Cylia Niu

A companion creature that only grows on **verified, undistracted study time**, tied to your real class schedule.

```bash
npm run dev     # http://localhost:3000

cp .env.example .env.local   # optional — AI recall checks and a real Canvas instance
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
src/app/api/      recall, graphql, canvas/session route handlers (all server-side code)
src/lib/          types, storage, time/schedule helpers, growth rules, zones,
                  recall questions, store (context)
src/lib/canvas/   Canvas LMS GraphQL backend — schema, REST client, fixtures
src/hooks/        useFocusSession (the verification engine), useGeolocation,
                  useCanvas, useRecallCheck, useNow
src/components/   FocusPanel, SchedulePanel, CanvasCard, CompanionCard, TodaySummary,
                  LocationCard, RecallCheck, SessionSummary
```

## Canvas GraphQL backend

`POST /api/graphql` is a GraphQL layer over the **Canvas LMS API**. Open `http://localhost:3000/api/graphql` in a browser for GraphiQL (dev only).

It exists because Canvas' REST API is one request *per course per resource* — three courses' assignments is four round trips from the browser, and the access token would have to be there to make them. One query here does the fan-out server-side instead:

```graphql
{
  courses {
    courseCode
    enrollments { currentScore currentGrade }
    assignments(bucket: UPCOMING) { name dueAt isOutstanding }
  }
}
```

**Schedule import.** `studyBlocks` is the query the schedule table wants. Canvas materialises a recurring lecture as one calendar event *per occurrence*; [`schedule.ts`](src/lib/canvas/schedule.ts) collapses occurrences sharing a title, course, and time-of-day back into one recurring block, so the result drops straight into `StudyBlock` — minutes-from-midnight, `days` as `0–6`, `source: "canvas"`, `externalId` set from the first occurrence so a re-import updates rather than duplicates.

```graphql
{ studyBlocks { externalId title course startMin endMin days source } }
```

**Import is idempotent.** [`importCanvasBlocks`](src/lib/store.tsx) upserts on `externalId`, so pressing Import twice reports *"already up to date"* rather than doubling the schedule, and a changed lecture time updates the existing row. Imported blocks are tagged **Canvas** in the schedule and behave like any other block — you can start a session from one, edit it, or delete it.

Also available: `self`, `course(id:)`, `assignments(bucket:, limit:)` across all courses, `calendarEvents`, and per-course `modules`.

**Logging in.** The **Canvas** card on the dashboard takes an instance URL and a personal access token. [`/api/canvas/session`](src/app/api/canvas/session/route.ts) verifies the token against that instance *before* storing it, so a typo surfaces on the form rather than as a broken dashboard later.

**The token never touches client JavaScript.** It goes into an `httpOnly` session cookie, which the browser attaches to `/api/graphql` automatically — an XSS bug can't read it back out the way it could read `localStorage`. No `maxAge`, so closing the browser ends the connection; that matters on a shared lab machine. Disconnecting clears the cookie but *keeps* imported blocks — that's a credential being revoked, not a timetable being deleted.

**Credentials resolve per request, most specific first:**

| Source | Use |
| --- | --- |
| `X-Canvas-Token` + `X-Canvas-Base-Url` headers | Scripts and other non-browser callers |
| The `incline_canvas` httpOnly cookie | The dashboard login |
| `CANVAS_BASE_URL` + `CANVAS_ACCESS_TOKEN` env | A single account |
| None of the above | In-memory fixtures |

With no credentials at all it serves [fixtures](src/lib/canvas/mock.ts) — three real-looking UoA courses, a full weekly timetable, assignments and submissions — so the API is fully explorable with no Canvas account, and the demo can't be broken by a campus SSO outage. Fixture dates are generated relative to the current week, so "upcoming" work stays upcoming. `{ dataSource }` reports which backend answered.

Both paths go through the same [`CanvasSource`](src/lib/canvas/source.ts) interface, so the resolvers never branch on which one they got. Tokens are read off the request, used for that request, and never stored or sent to the browser. Canvas errors (401/403/404) pass through with their status under `extensions.code: CANVAS_API_ERROR` rather than being masked, since the caller can act on them.

## Not built yet

- **Canvas OAuth** — login is by personal access token, which is the right call for a hackathon (no developer key to register with the university). A real deployment would want the OAuth2 flow so students never handle a token.
