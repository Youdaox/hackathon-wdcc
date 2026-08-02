import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Server-side schema for the mobile sync contract.
 *
 * The web MVP keeps its own copy of everything in localStorage and is still
 * authoritative for its own device. These tables exist so the iOS app — which
 * has no localStorage to share — can sync against one companion.
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
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Server-side sessions: only a hash of the browser cookie token is stored. */
export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("auth_sessions_user_idx").on(table.userId)],
);

/** Mutual, account-backed connections used to limit encouragement sharing. */
export const friendships = sqliteTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    friendId: text("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
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
export const companions = sqliteTable("companions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  species: text("species").notNull(),
  /** Cosmetic coat color — see PigColor in src/lib/types.ts. */
  color: text("color").notNull().default("pink"),
  /** Cosmetic worn accessory — see PigAccessory in src/lib/types.ts. */
  accessory: text("accessory").notNull().default("none"),
  checkInEmotion: text("check_in_emotion"),
  checkInAt: integer("check_in_at"),
  nextCheckInAt: integer("next_check_in_at"),
  level: integer("level").notNull(),
  /** XP toward the *current* level only, not lifetime. */
  xp: integer("xp").notNull(),
  /** 0-100. */
  hp: real("hp").notNull(),
  totalFocusedMs: integer("total_focused_ms").notNull(),
  lastSessionAt: integer("last_session_at"),
  createdAt: integer("created_at").notNull(),
});

/**
 * A completed focus session, from either client.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startTime: integer("start_time").notNull(),
    endTime: integer("end_time").notNull(),
    /** Verified focused minutes as reported by the client. */
    verifiedMinutes: real("verified_minutes").notNull(),
    locationVerified: integer("location_verified", { mode: "boolean" }).notNull(),
    locationName: text("location_name"),
    platform: text("platform", { enum: ["android", "ios", "web"] }).notNull(),
    /** Growth the server computed for this session — not client-supplied. */
    xpEarned: integer("xp_earned").notNull(),
    hpDelta: integer("hp_delta").notNull(),
    xpMultiplier: real("xp_multiplier").notNull(),
    /**
     * Minutes the user pledged before starting, or 0 for an open session.
     * A pledge is the whole basis of the forfeit rule below.
     */
    committedMinutes: real("committed_minutes").notNull().default(0),
    /**
     * True when a pledge was broken. The session is still recorded — the
     * point is that it happened and earned nothing, not that it vanishes.
     */
    voided: integer("voided", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId, table.endTime)],
);

/**
 * One stretch of a session spent away from the app.
 *
 * iOS never discloses which app the user switched to, so everything here is
 * self-reported: `reason` from the return check-in, `appLabel` from a Shortcuts
 * automation the user set up. Both are honest signals precisely because the
 * user chose to give them.
 */
export const distractionEvents = sqliteTable(
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
    timestamp: integer("timestamp").notNull(),
    durationSeconds: real("duration_seconds").notNull(),
    /**
     * Android package name, reported by the blocker's usage-access watcher.
     * Null everywhere else — iOS never discloses the foregrounded app.
     */
    appIdentifier: text("app_identifier"),
    /**
     * Which app pulled them away, when known.
     *
     * Unlike the Android package name this replaced, this is *user-supplied*:
     * it arrives from a Shortcuts automation the user configured themselves,
     * carrying whatever label they typed. iOS still never tells us. Treated as
     * a display string only, never matched against anything.
     */
    appLabel: text("app_label"),
    /** True when the user pushed past the intercept screen. */
    bypassed: integer("bypassed", { mode: "boolean" }).notNull().default(false),
    /**
     * Why the user says they left, from the return check-in. Null when the
     * stretch was too short to be worth asking about.
     *
     * This is the diagnostic half of the mechanic: "emergency" eight times in
     * a week is a pattern worth showing someone, and it can't be inferred from
     * duration alone.
     */
    reason: text("reason", {
      enum: ["emergency", "task", "distraction", "ended"],
    }),
    /**
     * What the user *guessed* the stretch was, before being shown the real
     * number. Kept because the gap between guess and actual is the interesting
     * signal — people are consistently bad at this, and the surprise does more
     * motivating work than the raw duration.
     */
    guessedSeconds: real("guessed_seconds"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("distraction_events_session_idx").on(table.sessionId),
    index("distraction_events_user_idx").on(table.userId, table.timestamp),
  ],
);

/**
 * Verified study locations. A null `userId` marks a shared campus default that
 * every user gets; a set `userId` is that user's own spot.
 */
export const studySpots = sqliteTable(
  "study_spots",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    radiusM: real("radius_m").notNull(),
    /** XP multiplier, matching the web app's bonus zones. */
    multiplier: real("multiplier").notNull().default(1),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("study_spots_user_idx").on(table.userId)],
);

/**
 * The Android blocker's watch list — package names to look for via
 * UsageStatsManager.
 *
 * iOS has no equivalent and never will: the OS does not tell a third-party app
 * what is on screen, so there is nothing to match a list against.
 */
export const distractionApps = sqliteTable(
  "distraction_apps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    appIdentifier: text("app_identifier").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("distraction_apps_user_idx").on(table.userId)],
);
