import type { CanvasCalendarEvent, CanvasDerivedBlock } from "./types";
import { nzParts } from "../timezone";

/**
 * Canvas calendar events → Incline study blocks.
 *
 * Canvas materialises a recurring lecture as one event per occurrence, but
 * Incline's schedule table stores one *recurring* block with a `days` array.
 * So occurrences that share a title, course, and time-of-day are collapsed back
 * into a single block covering every weekday they land on.
 *
 * Times become minutes-from-midnight in New Zealand time, matching
 * `StudyBlock` in `src/lib/types.ts`.
 */

function minutesFromMidnight(iso: string): number {
  const { hour, minute } = nzParts(new Date(iso));
  return hour * 60 + minute;
}

/** 0 = Sunday … 6 = Saturday, matching `StudyBlock.days`. */
function weekday(iso: string): number {
  return nzParts(new Date(iso)).weekday;
}

export function eventsToStudyBlocks(events: CanvasCalendarEvent[]): CanvasDerivedBlock[] {
  const byShape = new Map<string, CanvasDerivedBlock>();

  for (const event of events) {
    if (!event.start_at || !event.end_at) continue; // Undated events aren't schedulable.

    const startMin = minutesFromMidnight(event.start_at);
    const endMin = minutesFromMidnight(event.end_at);
    if (endMin <= startMin) continue; // Skip anything crossing midnight or zero-length.

    const course = event.context_name ?? event.context_code;
    const key = `${event.title}|${course}|${startMin}|${endMin}`;
    const day = weekday(event.start_at);

    const existing = byShape.get(key);
    if (existing) {
      if (!existing.days.includes(day)) existing.days.push(day);
      continue;
    }

    byShape.set(key, {
      // The first occurrence's id anchors the block, so a re-import updates
      // rather than duplicates.
      externalId: event.id,
      title: event.title,
      course,
      startMin,
      endMin,
      days: [day],
    });
  }

  return [...byShape.values()]
    .map((block) => ({ ...block, days: block.days.sort((a, b) => a - b) }))
    .sort((a, b) => a.startMin - b.startMin || a.title.localeCompare(b.title));
}
