export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  location: string;
}
import { nzDateKey, nzParts } from "./timezone";

export type CalendarEventDraft = Omit<CalendarEvent, "id">;

function unfoldIcs(source: string) {
  return source.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function unescapeIcs(value = "") {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function dateAndTime(value: string) {
  const clean = value.replace(/Z$/, "");
  if (/^\d{8}T\d{6}$/.test(clean)) {
    return { date: `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`, time: `${clean.slice(9, 11)}:${clean.slice(11, 13)}` };
  }
  if (/^\d{8}$/.test(clean)) return { date: `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`, time: "09:00" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  const { hour, minute } = nzParts(parsed);
  return { date: nzDateKey(parsed), time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

export function parseIcs(source: string): CalendarEventDraft[] {
  const lines = unfoldIcs(source);
  const events: CalendarEventDraft[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT" && current) {
      const start = dateAndTime(current.DTSTART ?? "");
      const end = dateAndTime(current.DTEND ?? "");
      if (start && current.SUMMARY) {
        const proposedEnd = end?.time ?? "";
        const fallbackMinutes = Math.min(Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3)) + 60, 1439);
        const fallbackEnd = `${String(Math.floor(fallbackMinutes / 60)).padStart(2, "0")}:${String(fallbackMinutes % 60).padStart(2, "0")}`;
        const endTime = proposedEnd > start.time ? proposedEnd : fallbackEnd;
        events.push({ title: unescapeIcs(current.SUMMARY), date: start.date, startTime: start.time, endTime, description: unescapeIcs(current.DESCRIPTION), location: unescapeIcs(current.LOCATION) });
      }
      current = null; continue;
    }
    if (!current) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    current[line.slice(0, colon).split(";")[0]] = line.slice(colon + 1);
  }
  return events;
}
