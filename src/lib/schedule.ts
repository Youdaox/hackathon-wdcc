import type { StudyBlock } from "./types";
import { minutesOfDay } from "./time";
import { nzParts } from "./timezone";

/** A block resolved against a specific moment in the week. */
export interface BlockOccurrence {
  block: StudyBlock;
  /** Weekday it lands on (0 = Sun). */
  day: number;
  /** Minutes until it starts. 0 if already running. */
  minutesUntilStart: number;
  /** Minutes until it ends. Only meaningful when active. */
  minutesUntilEnd: number;
  isActive: boolean;
}

/** Blocks scheduled for a given weekday, earliest first. */
export function blocksOnDay(blocks: StudyBlock[], day: number): StudyBlock[] {
  return blocks
    .filter((b) => b.days.includes(day))
    .sort((a, b) => a.startMin - b.startMin);
}

/** The block currently in progress, if any. */
export function findActiveBlock(
  blocks: StudyBlock[],
  now: Date = new Date(),
): BlockOccurrence | null {
  const day = nzParts(now).weekday;
  const nowMin = minutesOfDay(now);
  const match = blocksOnDay(blocks, day).find(
    (b) => nowMin >= b.startMin && nowMin < b.endMin,
  );
  if (!match) return null;
  return {
    block: match,
    day,
    minutesUntilStart: 0,
    minutesUntilEnd: match.endMin - nowMin,
    isActive: true,
  };
}

/**
 * The next block that hasn't started yet — searches today, then forward up to
 * a full week so a Sunday-evening demo still shows Monday's 9am lecture.
 */
export function findNextBlock(
  blocks: StudyBlock[],
  now: Date = new Date(),
): BlockOccurrence | null {
  if (blocks.length === 0) return null;
  const nowMin = minutesOfDay(now);
  const today = nzParts(now).weekday;

  for (let offset = 0; offset < 7; offset++) {
    const day = (today + offset) % 7;
    for (const block of blocksOnDay(blocks, day)) {
      const startsInMin =
        offset === 0 ? block.startMin - nowMin : offset * 1440 + block.startMin - nowMin;
      if (startsInMin > 0) {
        return {
          block,
          day,
          minutesUntilStart: startsInMin,
          minutesUntilEnd: startsInMin + (block.endMin - block.startMin),
          isActive: false,
        };
      }
    }
  }
  return null;
}

/** "in 25m" / "in 3h 10m" / "in 2d" */
export function formatCountdown(minutes: number): string {
  if (minutes < 60) return `in ${minutes}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  const d = Math.floor(minutes / 1440);
  return d === 1 ? "tomorrow" : `in ${d}d`;
}

/** Guards against zero-length or inverted blocks at the form boundary. */
export function isValidRange(startMin: number, endMin: number): boolean {
  return endMin > startMin;
}
