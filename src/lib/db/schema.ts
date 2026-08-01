import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
 * A completed focus session, from any platform.
 *
 * `platform` and the nullable `app_identifier` on distraction events are the
 * schema-level accommodation for the Android/iOS asymmetry: Android reports
 * which app was opened, iOS can only report that *a* restricted app was.
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
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId, table.endTime)],
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
    appIdentifier: text("app_identifier"),
    timestamp: integer("timestamp").notNull(),
    durationSeconds: real("duration_seconds").notNull(),
    bypassed: integer("bypassed", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at").notNull(),
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
