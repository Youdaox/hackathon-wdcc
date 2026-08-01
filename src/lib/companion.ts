import type { ActiveSession, AvatarEmotion, Companion, Mood, PigColor } from "./types";
import { uid } from "./storage";

/**
 * Companion growth rules — the whole game balance lives here so it can be
 * explained (and tuned) in one place.
 */
export const RULES = {
  /** XP per verified focused minute. */
  xpPerFocusedMinute: 1,
  /** XP needed to clear level N. Grows linearly: L1 = 30, L2 = 60, … */
  xpForLevel: (level: number) => 30 * level,
  /** HP lost per penalized distraction event. */
  hpPerDistraction: 8,
  /** HP regained per focused minute. */
  hpPerFocusedMinute: 0.5,
  /** Hidden stretches shorter than this cost focus time but not HP. */
  graceMs: 5_000,
  /** HP lost per full day with no completed session. */
  hpDecayPerIdleDay: 6,
  maxHp: 100,
} as const;

export function createCompanion(name = "Oinky", color: PigColor = "pink"): Companion {
  return {
    name,
    species: "pig",
    color,
    accessory: "none",
    checkInEmotion: null,
    checkInAt: null,
    level: 1,
    xp: 0,
    hp: 100,
    totalFocusedMs: 0,
    lastSessionAt: null,
    createdAt: Date.now(),
  };
}

export function moodFor(hp: number): Mood {
  if (hp >= 80) return "happy";
  if (hp >= 50) return "neutral";
  if (hp >= 25) return "sad";
  return "sick";
}

/** Low health takes priority; otherwise, show the feeling from the latest check-in. */
export function avatarStateFor(hp: number, emotion: AvatarEmotion | null): string {
  if (hp < 25) return "needs-care";
  if (hp < 50) return "needs-energy";
  return emotion ?? moodFor(hp);
}

export const MOOD_LABEL: Record<Mood, string> = {
  happy: "Healthy",
  neutral: "Content",
  sad: "Hungry",
  sick: "Sick",
};

/** XP earned by a session's focused time, before any multiplier. */
export function xpFromFocusedMs(focusedMs: number): number {
  return Math.floor((focusedMs / 60_000) * RULES.xpPerFocusedMinute);
}

/** Progress within the current level, for the XP bar. */
export function levelProgress(companion: Companion): {
  xp: number;
  needed: number;
  pct: number;
} {
  const needed = RULES.xpForLevel(companion.level);
  return {
    xp: companion.xp,
    needed,
    pct: Math.min(100, (companion.xp / needed) * 100),
  };
}

export interface GrowthResult {
  companion: Companion;
  xpEarned: number;
  hpDelta: number;
  levelsGained: number;
}

/**
 * Applies a finished session to the companion. Pure — takes the old companion,
 * returns a new one, so it's trivial to test and to reason about live.
 */
export function applySession(
  companion: Companion,
  session: Pick<ActiveSession, "focusedMs" | "distractions"> & { bonusXp?: number },
  xpMultiplier = 1,
): GrowthResult {
  const focusedMinutes = session.focusedMs / 60_000;
  // The location multiplier scales earned focus time; recall bonus is flat on
  // top, so a correct answer is worth the same wherever you are.
  const xpEarned =
    Math.floor(xpFromFocusedMs(session.focusedMs) * xpMultiplier) + (session.bonusXp ?? 0);

  const penalties = session.distractions.filter((d) => d.penalized).length;
  const hpLost = penalties * RULES.hpPerDistraction;
  const hpGained = focusedMinutes * RULES.hpPerFocusedMinute;
  const nextHp = clampHp(companion.hp - hpLost + hpGained);

  let level = companion.level;
  let xp = companion.xp + xpEarned;
  let levelsGained = 0;
  while (xp >= RULES.xpForLevel(level)) {
    xp -= RULES.xpForLevel(level);
    level += 1;
    levelsGained += 1;
  }

  return {
    companion: {
      ...companion,
      level,
      xp,
      hp: nextHp,
      totalFocusedMs: companion.totalFocusedMs + session.focusedMs,
      lastSessionAt: Date.now(),
    },
    xpEarned,
    hpDelta: Math.round(nextHp - companion.hp),
    levelsGained,
  };
}

/**
 * Neglect decay, applied once on load. Keeps the stakes real without needing a
 * background job — we just compare against the last completed session.
 */
export function applyIdleDecay(companion: Companion, now = Date.now()): Companion {
  if (companion.lastSessionAt === null) return companion;
  const idleDays = Math.floor((now - companion.lastSessionAt) / 86_400_000);
  if (idleDays < 1) return companion;
  const hp = clampHp(companion.hp - idleDays * RULES.hpDecayPerIdleDay);
  return hp === companion.hp ? companion : { ...companion, hp };
}

function clampHp(hp: number): number {
  return Math.max(0, Math.min(RULES.maxHp, hp));
}

/** Reaction line for the session-end screen. */
export function reactionFor(
  result: GrowthResult,
  distractionCount: number,
  focusedMs: number,
): string {
  const name = result.companion.name;
  if (result.levelsGained > 0) return `${name} grew! That focus went straight into new roots.`;
  if (focusedMs < 60_000) return `Barely enough time to stretch. ${name} is waiting.`;
  if (distractionCount === 0) return `Not a single wobble. ${name} is thriving on that.`;
  if (distractionCount <= 2) return `${name} noticed you slip away, but you came back.`;
  return `${name} spent a lot of that session alone.`;
}

export { uid };
