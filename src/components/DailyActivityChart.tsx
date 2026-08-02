"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EVENT_CATEGORIES, EVENT_CATEGORY_COLOUR, type CalendarEvent, type EventCategory } from "@/lib/calendar";
import { addNewZealandDays, nzParts, nzStartOfDay } from "@/lib/timezone";

type ChartCategory = EventCategory | "sleep";
type DayActivity = Record<ChartCategory, number>;

const CATEGORY_LABEL: Record<EventCategory, string> = {
  study: "Study",
  sport: "Sport",
  executive: "Executive",
  work: "Work",
};
const CHART_CATEGORIES: ChartCategory[] = [...EVENT_CATEGORIES, "sleep"];
const CATEGORY_COLOUR: Record<ChartCategory, string> = {
  ...EVENT_CATEGORY_COLOUR,
  sleep: "bg-indigo-300 dark:bg-indigo-400",
};
const SLEEP_LABEL = "Sleep (demo)";
const DUMMY_SLEEP_HOURS = [7, 6.5, 8, 6, 7.5, 8, 5];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_HOURS = 16;

function durationHours(event: CalendarEvent): number {
  const [startHour, startMinute] = event.startTime.split(":").map(Number);
  const [endHour, endMinute] = event.endTime.split(":").map(Number);
  return Math.max(0, (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60);
}

export function DailyActivityChart() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/calendar/events", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { events: CalendarEvent[] };
    setEvents(data.events);
    setLoaded(true);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- the event API is the external source for this chart */
  useEffect(() => {
    void load();
    const onCalendarChange = (event: Event) => {
      const imported = (event as CustomEvent<{ events?: CalendarEvent[] }>).detail?.events;
      if (imported?.length) {
        setEvents((current) => {
          const ids = new Set(imported.map((item) => item.id));
          return [...current.filter((item) => !ids.has(item.id)), ...imported]
            .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
        });
        setLoaded(true);
        return;
      }
      void load();
    };
    window.addEventListener("calendar-events-changed", onCalendarChange);
    return () => window.removeEventListener("calendar-events-changed", onCalendarChange);
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { days, maxHours } = useMemo(() => {
    const now = new Date();
    const today = nzParts(now);
    // The calendar grid starts on Sunday, so the chart uses the same week.
    const sunday = addNewZealandDays(nzStartOfDay(now), -today.weekday);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addNewZealandDays(sunday, index);
      const parts = nzParts(date);
      const dateKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
      const activity: DayActivity = { study: 0, sport: 0, executive: 0, work: 0, sleep: parts.weekday === today.weekday ? 0 : DUMMY_SLEEP_HOURS[index] };
      events.filter((event) => event.date === dateKey).forEach((event) => { activity[event.category] += durationHours(event); });
      return { ...activity, label: DAY_NAMES[parts.weekday], isToday: parts.weekday === today.weekday };
    });
    const largestDay = Math.max(...days.map((day) => CHART_CATEGORIES.reduce((sum, category) => sum + day[category], 0)));
    return { days, maxHours: Math.max(MAX_HOURS, Math.ceil(largestDay / 4) * 4) };
  }, [events]);

  return (
    <section className="card p-6" aria-labelledby="daily-activity-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">This week</p>
          <h2 id="daily-activity-title" className="mt-1 text-lg font-bold">Daily rhythm</h2>
          <p className="mt-0.5 text-sm text-muted">Hours from your categorised calendar events.</p>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-faint">Hours</span>
      </div>

      <div className="mt-5 flex h-44 items-end gap-2 border-b border-line-soft pb-1" role="img" aria-label="Weekly chart showing daily study, sport, executive, work, and demo sleep hours">
        {days.map((day) => (
          <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-32 w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-lg bg-surface-2" title={`${day.label}: ${CHART_CATEGORIES.map((category) => `${day[category]}h ${category === "sleep" ? "sleep" : CATEGORY_LABEL[category].toLowerCase()}`).join(", ")}`}>
              {CHART_CATEGORIES.map((category) => <div key={category} className={CATEGORY_COLOUR[category]} style={{ height: `${(day[category] / maxHours) * 100}%` }} />)}
            </div>
            <span className={`text-[10px] font-bold ${day.isToday ? "text-moss" : "text-faint"}`}>{day.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
        {EVENT_CATEGORIES.map((category) => <Legend key={category} color={CATEGORY_COLOUR[category]} label={CATEGORY_LABEL[category]} />)}
        <Legend color={CATEGORY_COLOUR.sleep} label={SLEEP_LABEL} />
      </div>
      {loaded && events.length === 0 && <p className="mt-4 text-xs text-faint">Add categorised events to see your week take shape.</p>}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</span>;
}
