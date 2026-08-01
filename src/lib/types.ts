/**
 * Incline — core data model.
 *
 * Deliberately small: three persisted collections (schedule, companion, sessions).
 * Everything on screen is derived from these.
 */

/** Where a study block came from. Canvas import can slot in later without a migration. */
export type BlockSource = "manual" | "canvas";

/**
 * A recurring study/class block on the user's weekly schedule.
 * Times are minutes-from-midnight so comparisons are plain integer math.
 */
export interface StudyBlock {
  id: string;
  title: string;
  /** Linked subject/course, e.g. "COMPSCI 235". Used later for AI recall questions. */
  course: string;
  /** Minutes from midnight, 0–1439. */
  startMin: number;
  /** Minutes from midnight, 0–1439. */
  endMin: number;
  /** Weekdays this repeats on. 0 = Sunday … 6 = Saturday. */
  days: number[];
  source: BlockSource;
  /** Canvas event/assignment id, when source === "canvas". */
  externalId?: string;
  createdAt: number;
}

/** Mood is derived from HP — never stored, so the two can't disagree. */
export type Mood = "happy" | "neutral" | "sad" | "sick";

/** Pastel coat options for the pig companion. */
export type PigColor = "pink" | "purple" | "blue";
export const PIG_COLOR_VALUES: PigColor[] = ["pink", "purple", "blue"];

/** Cosmetic accessory worn by the pig — purely visual, no gameplay effect. */
export type PigAccessory = "none" | "glasses" | "flower";
export const PIG_ACCESSORY_VALUES: PigAccessory[] = ["none", "glasses", "flower"];

export interface Companion {
  name: string;
  species: string;
  /** Coat color — purely cosmetic. */
  color: PigColor;
  /** Worn accessory — purely cosmetic. */
  accessory: PigAccessory;
  level: number;
  /** XP accumulated toward the *current* level only. */
  xp: number;
  /** 0–100. */
  hp: number;
  /** Lifetime verified focused milliseconds. */
  totalFocusedMs: number;
  /** Timestamp of the last completed session — drives neglect decay. */
  lastSessionAt: number | null;
  createdAt: number;
}

/** One hidden-tab stretch during a session. */
export interface DistractionEvent {
  startedAt: number;
  durationMs: number;
  /** Short blips are forgiven — they cost focus time but not HP. */
  penalized: boolean;
}

/** A finished focus session. The live session is held in memory until it ends. */
export interface FocusSession {
  id: string;
  /** Set when the session was started from a scheduled block. */
  blockId: string | null;
  title: string;
  course: string;
  startedAt: number;
  endedAt: number;
  /** Wall-clock length of the session. */
  totalMs: number;
  /** Time with the tab visible — the only time that earns XP. */
  focusedMs: number;
  /** Time with the tab hidden. */
  distractedMs: number;
  distractions: DistractionEvent[];
  xpEarned: number;
  hpDelta: number;
  /** Geolocation bonus-zone multiplier. 1 = no bonus. */
  xpMultiplier: number;
  /** Bonus zone the session ended in, when one applied. */
  zoneName?: string;
  /** Flat XP from a correct recall check. Not affected by the multiplier. */
  bonusXp: number;
}

/** Live, in-progress session state. Not persisted as-is. */
export interface ActiveSession {
  id: string;
  blockId: string | null;
  title: string;
  course: string;
  startedAt: number;
  /** Planned length in ms, or null for an open-ended session. */
  plannedMs: number | null;
  focusedMs: number;
  distractedMs: number;
  distractions: DistractionEvent[];
  /** True while the tab is hidden. */
  isHidden: boolean;
  /** When the current hidden stretch began, if any. */
  hiddenSince: number | null;
  /** Flat XP earned from a correct recall check this session. */
  bonusXp: number;
}
