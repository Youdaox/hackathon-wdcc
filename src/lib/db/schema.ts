import { sql } from "drizzle-orm";
import { bigint, boolean, doublePrecision, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Server-side schema for the mobile sync contract.
 *
 * The web MVP keeps its own copy of everything in localStorage and is still
 * authoritative for its own device. These tables exist so Android and iOS —
 * which have no localStorage to share — can sync against one companion.
 *
 * Timestamps are stored as epoch milliseconds (integers) to match the web
 * model in `src/lib/types.ts`, not as SQLite datetimes. The API speaks ISO8601
 * at the boundary and converts in `src/lib/api/contract.ts`.
 */

/**
 * There is no auth. `id` is whatever string the client sends as `user_id`, and
 * rows are created on first sight. That is deliberate for a hackathon demo —
 * see the note in the README before this goes anywhere real.
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/** Server-side sessions: only a hash of the browser cookie token is stored. */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("auth_sessions_user_idx").on(table.userId)],
);

/** Dated calendar events are server-backed so every account has a private calendar. */
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    eventDate: text("event_date").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    description: text("description").notNull().default(""),
    location: text("location"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [index("calendar_events_user_date_idx").on(table.userId, table.eventDate)],
);

/** Secret bearer token used by calendar apps, which cannot send the login cookie. */
export const calendarFeedTokens = pgTable("calendar_feed_tokens", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/** Mutual, account-backed connections used to limit encouragement sharing. */
export const friendships = pgTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    friendId: text("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("friendships_user_idx").on(table.userId),
    uniqueIndex("friendships_pair_unique").on(table.userId, table.friendId),
  ],
);

/**
 * One companion per user. Mirrors the `Companion` interface field-for-field so
 * `applySession()` from `src/lib/companion.ts` can run against a row directly
 * with no translation layer.
 *
 * Mood is absent on purpose: it is derived from `hp`, never stored, so the two
 * cannot disagree.
 */
export const companions = pgTable("companions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  species: text("species").notNull(),
  /** Cosmetic coat color — see CompanionColor in src/lib/types.ts. Valid values depend on `species`. */
  color: text("color").notNull().default("pink"),
  /** Cosmetic worn accessory — see PigAccessory in src/lib/types.ts. */
  accessory: text("accessory").notNull().default("none"),
  checkInEmotion: text("check_in_emotion"),
  checkInAt: bigint("check_in_at", { mode: "number" }),
  nextCheckInAt: bigint("next_check_in_at", { mode: "number" }),
  lastMeal: text("last_meal"),
  lastMealAt: bigint("last_meal_at", { mode: "number" }),
  lastWaterAt: bigint("last_water_at", { mode: "number" }),
  nextWaterCheckAt: bigint("next_water_check_at", { mode: "number" }),
  foodBreakMissed: boolean("food_break_missed").notNull().default(false),
  waterBreakMissed: boolean("water_break_missed").notNull().default(false),
  level: integer("level").notNull(),
  /** XP toward the *current* level only, not lifetime. */
  xp: integer("xp").notNull(),
  /** 0-100. */
  hp: doublePrecision("hp").notNull(),
  totalFocusedMs: bigint("total_focused_ms", { mode: "number" }).notNull(),
  lastSessionAt: bigint("last_session_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/**
 * A completed focus session, from any platform.
 *
 * `platform` and the nullable `app_identifier` on distraction events are the
 * schema-level accommodation for the Android/iOS asymmetry: Android reports
 * which app was opened, iOS can only report that *a* restricted app was.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startTime: bigint("start_time", { mode: "number" }).notNull(),
    endTime: bigint("end_time", { mode: "number" }).notNull(),
    /** Verified focused minutes as reported by the client. */
    verifiedMinutes: doublePrecision("verified_minutes").notNull(),
    locationVerified: boolean("location_verified").notNull(),
    locationName: text("location_name"),
    platform: text("platform", { enum: ["android", "ios", "web"] }).notNull(),
    /** Growth the server computed for this session — not client-supplied. */
    xpEarned: integer("xp_earned").notNull(),
    hpDelta: integer("hp_delta").notNull(),
    xpMultiplier: doublePrecision("xp_multiplier").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId, table.endTime)],
);

/** Ephemeral, consented study context captured during one web focus session. */
export const studyMemorySessions = pgTable(
  "study_memory_sessions",
  {
    id: text("id").primaryKey(),
    focusSessionId: text("focus_session_id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    course: text("course").notNull(),
    status: text("status", { enum: ["capturing", "ready", "submitted", "failed"] }).notNull(),
    consentVersion: text("consent_version").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    completedAt: bigint("completed_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("study_memory_focus_user_unique").on(table.focusSessionId, table.userId),
    index("study_memory_user_idx").on(table.userId, table.createdAt),
  ],
);

export const studyObservations = pgTable(
  "study_observations",
  {
    id: text("id").primaryKey(),
    memorySessionId: text("memory_session_id").notNull().references(() => studyMemorySessions.id, { onDelete: "cascade" }),
    sourceName: text("source_name").notNull(),
    capturedAt: bigint("captured_at", { mode: "number" }).notNull(),
    imageHash: text("image_hash").notNull(),
    extractedText: text("extracted_text").notNull(),
    summary: text("summary").notNull(),
    topicsJson: text("topics_json").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("study_observation_hash_unique").on(table.memorySessionId, table.imageHash),
    index("study_observation_session_idx").on(table.memorySessionId, table.capturedAt),
  ],
);

export const studyChunks = pgTable(
  "study_chunks",
  {
    id: text("id").primaryKey(),
    memorySessionId: text("memory_session_id").notNull().references(() => studyMemorySessions.id, { onDelete: "cascade" }),
    observationId: text("observation_id").notNull().references(() => studyObservations.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    embeddingJson: text("embedding_json").notNull(),
    embeddingModel: text("embedding_model").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("study_chunks_session_idx").on(table.memorySessionId)],
);

export const recallChecks = pgTable(
  "recall_checks",
  {
    id: text("id").primaryKey(),
    memorySessionId: text("memory_session_id").notNull().references(() => studyMemorySessions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    questionsJson: text("questions_json").notNull(),
    evidenceJson: text("evidence_json").notNull(),
    status: text("status", { enum: ["ready", "submitted", "skipped"] }).notNull(),
    score: integer("score"),
    feedbackJson: text("feedback_json"),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    submittedAt: bigint("submitted_at", { mode: "number" }),
  },
  (table) => [uniqueIndex("recall_check_memory_unique").on(table.memorySessionId)],
);

/**
 * One distraction during a session.
 *
 * `appIdentifier` is null on iOS by Apple's design — a DeviceActivityMonitor
 * event tells us a shielded app was opened but never which one. Null here means
 * "not knowable", not "missing data".
 *
 * `bypassed` is Android-only in practice: iOS owns the shield screen, so there
 * is no bypass button to press.
 */
export const distractionEvents = pgTable(
  "distraction_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Null while a session is still running — the mobile clients POST events
     * live, and the session row only exists once the session ends.
     */
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "cascade" }),
    appIdentifier: text("app_identifier"),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    durationSeconds: doublePrecision("duration_seconds").notNull(),
    bypassed: boolean("bypassed").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("distraction_events_session_idx").on(table.sessionId),
    index("distraction_events_user_idx").on(table.userId, table.timestamp),
  ],
);

/**
 * Android's distraction list — package names to watch for with
 * UsageStatsManager. iOS does not use this: the user picks apps through
 * Apple's own FamilyActivityPicker and we only ever hold an opaque token.
 */
export const distractionApps = pgTable(
  "distraction_apps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appIdentifier: text("app_identifier").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("distraction_apps_user_idx").on(table.userId)],
);

/**
 * Verified study locations. A null `userId` marks a shared campus default that
 * every user gets; a set `userId` is that user's own spot.
 */
export const studySpots = pgTable(
  "study_spots",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    radiusM: doublePrecision("radius_m").notNull(),
    /** XP multiplier, matching the web app's bonus zones. */
    multiplier: doublePrecision("multiplier").notNull().default(1),
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => [index("study_spots_user_idx").on(table.userId)],
);
