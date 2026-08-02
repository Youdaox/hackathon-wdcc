import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";

export async function calendarRows(userId: string) {
  return await db.select().from(calendarEvents).where(eq(calendarEvents.userId, userId));
}

function escape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function stamp(date: string, time: string) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

export async function toIcs(userId: string) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const body = (await calendarRows(userId)).flatMap((event) => [
    "BEGIN:VEVENT", `UID:${event.id}@incline.local`, `DTSTAMP:${now}`,
    `DTSTART:${stamp(event.eventDate, event.startTime)}`, `DTEND:${stamp(event.eventDate, event.endTime)}`,
    `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`,
    ...(event.location ? [`LOCATION:${escape(event.location)}`] : []), "END:VEVENT",
  ]);
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Incline//Calendar//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Incline", ...body, "END:VCALENDAR", ""].join("\r\n");
}

export async function icsResponse(userId: string, download = false) {
  return new Response(await toIcs(userId), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", ...(download ? { "Content-Disposition": 'attachment; filename="incline-calendar.ics"' } : {}) } });
}
