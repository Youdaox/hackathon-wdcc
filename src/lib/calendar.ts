export const EVENT_CATEGORIES = ["study", "sport", "executive", "work"] as const;
export type EventCategory = typeof EVENT_CATEGORIES[number];
/** Shared by the calendar and the weekly chart, so category meaning stays visual too. */
export const EVENT_CATEGORY_COLOUR: Record<EventCategory, string> = {
  study: "bg-moss",
  sport: "bg-citrus",
  executive: "bg-violet-400 dark:bg-violet-500",
  work: "bg-clay",
};

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  category: EventCategory;
  description: string;
  location: string;
}
import { NEW_ZEALAND_TIME_ZONE, nzDateKey, nzParts } from "./timezone";

export type CalendarEventDraft = Omit<CalendarEvent, "id">;

const SPORT_NAMES = /\b(basketball|volleyball|football|soccer|rugby|netball|cricket|tennis|badminton|squash|table tennis|hockey|baseball|softball|golf|swimming|rowing|cycling|running|athletics|gymnastics|martial arts|karate|judo|taekwondo|boxing|climbing|dance)\b/i;

function categoryFromIcs(value: string | undefined, title: string): EventCategory {
  const category = value?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (EVENT_CATEGORIES.includes(category as EventCategory)) return category as EventCategory;
  if (["sport", "sports", "athletics", "fitness"].includes(category)) return "sport";
  if (["executive", "exec", "club", "society", "leadership"].includes(category)) return "executive";
  if (["work", "job", "employment", "shift"].includes(category)) return "work";
  if (SPORT_NAMES.test(title)) return "sport";
  return "study";
}

function unfoldIcs(source: string) {
  return source.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function unescapeIcs(value = "") {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function fromPartsInZone(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-NZ", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const fields = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    instant += target - Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day), Number(fields.hour), Number(fields.minute));
  }
  return new Date(instant);
}

function nzDateAndTime(date: Date) {
  const { hour, minute } = nzParts(date);
  return { date: nzDateKey(date), time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

function dateAndTime(value: string, timeZone?: string) {
  const isUtc = value.endsWith("Z");
  const clean = value.replace(/Z$/, "");
  if (/^\d{8}T\d{6}$/.test(clean)) {
    const year = Number(clean.slice(0, 4)); const month = Number(clean.slice(4, 6)); const day = Number(clean.slice(6, 8));
    const hour = Number(clean.slice(9, 11)); const minute = Number(clean.slice(11, 13));
    if (isUtc) return nzDateAndTime(new Date(Date.UTC(year, month - 1, day, hour, minute)));
    if (timeZone && timeZone !== NEW_ZEALAND_TIME_ZONE) {
      try { return nzDateAndTime(fromPartsInZone(year, month, day, hour, minute, timeZone)); }
      catch { /* Unknown timezone identifiers fall back to floating calendar time. */ }
    }
    // Floating values have no source zone; calendar convention treats them as local NZ time.
    return { date: `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`, time: `${clean.slice(9, 11)}:${clean.slice(11, 13)}` };
  }
  if (/^\d{8}$/.test(clean)) return { date: `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`, time: "09:00" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  return nzDateAndTime(parsed);
}

export function parseIcs(source: string): CalendarEventDraft[] {
  const lines = unfoldIcs(source);
  const events: CalendarEventDraft[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT" && current) {
      const start = dateAndTime(current.DTSTART ?? "", current["DTSTART;TZID"]);
      const end = dateAndTime(current.DTEND ?? "", current["DTEND;TZID"]);
      if (start && current.SUMMARY) {
        const proposedEnd = end?.time ?? "";
        const fallbackMinutes = Math.min(Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3)) + 60, 1439);
        const fallbackEnd = `${String(Math.floor(fallbackMinutes / 60)).padStart(2, "0")}:${String(fallbackMinutes % 60).padStart(2, "0")}`;
        const endTime = proposedEnd > start.time ? proposedEnd : fallbackEnd;
        const title = unescapeIcs(current.SUMMARY);
        events.push({ title, date: start.date, startTime: start.time, endTime, category: categoryFromIcs(current.CATEGORIES, title), description: unescapeIcs(current.DESCRIPTION), location: unescapeIcs(current.LOCATION) });
      }
      current = null; continue;
    }
    if (!current) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const [key, ...parameters] = line.slice(0, colon).split(";");
    current[key] = line.slice(colon + 1);
    const timezone = parameters.find((parameter) => parameter.startsWith("TZID="))?.slice("TZID=".length);
    if (timezone) current[`${key}:TZID`] = timezone;
  }
  return events;
}
