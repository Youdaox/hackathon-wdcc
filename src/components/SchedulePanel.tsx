"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { EVENT_CATEGORIES, EVENT_CATEGORY_COLOUR, parseIcs, type CalendarEvent, type CalendarEventDraft, type EventCategory } from "@/lib/calendar";
import { nzDateKey, nzParts } from "@/lib/timezone";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EMPTY: CalendarEventDraft = { title: "", date: "", startTime: "09:00", endTime: "10:00", category: "study", description: "", location: "" };
const CATEGORY_LABEL: Record<(typeof EVENT_CATEGORIES)[number], string> = { study: "Study", sport: "Sport", executive: "Executive", work: "Work" };
type ImportCategory = EventCategory | "calendar";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { cache: "no-store", ...init });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error ?? "Calendar request failed.");
  return value;
}

export function SchedulePanel() {
  const today = new Date();
  const nzToday = nzParts(today);
  const [year, setYear] = useState(nzToday.year);
  const [month, setMonth] = useState(nzToday.month - 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState(nzDateKey(today));
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [importCategory, setImportCategory] = useState<ImportCategory>("calendar");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const value = await api("/api/calendar/events");
    setEvents(value.events);
  };
  useEffect(() => {
    let active = true;
    void api("/api/calendar/events")
      .then((value) => { if (active) setEvents(value.events); })
      .catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => { void api("/api/calendar/feed-url").then((value) => setFeedUrl(value.url)).catch(() => undefined); }, []);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cellCount = Math.ceil((first + days) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const date = new Date(Date.UTC(year, month, index - first + 1));
      return {
        date: date.toISOString().slice(0, 10),
        day: date.getUTCDate(),
        inCurrentMonth: date.getUTCMonth() === month && date.getUTCFullYear() === year,
      };
    });
  }, [month, year]);
  const byDate = useMemo(() => events.reduce<Record<string, CalendarEvent[]>>((map, event) => ((map[event.date] ??= []).push(event), map), {}), [events]);
  const selectedEvents = [...(byDate[selected] ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setYear(next.getUTCFullYear()); setMonth(next.getUTCMonth());
  };
  const selectDate = (date: string) => {
    setSelected(date); setEditing(null); setCreating(false);
  };
  const createOnDate = (date: string) => {
    setSelected(date); setEditing(null); setCreating(true);
  };
  const remove = async (id: string) => {
    await api(`/api/calendar/events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setEditing(null); await load(); setNotice("Event deleted.");
  };
  const importFile = async (file: File) => {
    const drafts = parseIcs(await file.text()).map((draft) => ({
      ...draft,
      // Keep compatible CATEGORIES from the source calendar so every event
      // reaches its matching segment in the weekly chart.
      category: importCategory === "calendar" ? draft.category : importCategory,
    }));
    if (!drafts.length) throw new Error("No supported events were found in that .ics file.");
    const result = await api("/api/calendar/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(drafts) }) as { events: CalendarEvent[] };
    // The chart receives the saved rows directly, so imported hours appear in
    // their correct calendar days without waiting for a second GET request.
    window.dispatchEvent(new CustomEvent("calendar-events-changed", { detail: { events: result.events } }));
    await load(); setNotice(`Imported ${drafts.length} event${drafts.length === 1 ? "" : "s"}.`);
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-line-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><h2 className="text-xl font-bold tabular">{year} Calendar</h2><p className="mt-1 text-sm text-muted">Plan events and keep your calendars in sync.</p></div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importFile(file).catch((error) => setNotice(error.message)); e.target.value = ""; }} />
          <label className="flex h-8 items-center gap-1 rounded-full border border-line bg-surface-2 px-2 text-[11px] font-semibold text-muted">Import as<select aria-label="Category for imported events" value={importCategory} onChange={(event) => setImportCategory(event.target.value as ImportCategory)} className="bg-transparent text-[11px] font-bold text-ink outline-none"><option value="calendar">Calendar category</option>{EVENT_CATEGORIES.map((category) => <option value={category} key={category}>{CATEGORY_LABEL[category]}</option>)}</select></label>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Import .ics</Button>
          <a href="/api/calendar/export" download className="inline-flex h-8 items-center rounded-full border border-line bg-surface-2 px-3 text-xs font-semibold hover:border-moss/60 hover:text-moss">Export .ics</a>
          <Button size="sm" onClick={() => { setSelected(new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)); setEditing(null); setCreating(true); }}>+ Event</Button>
        </div>
      </header>

      <div>
        <div className="min-w-0 p-3 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button aria-label="Previous month" onClick={() => moveMonth(-1)} className="h-9 w-9 rounded-full border border-line text-muted hover:text-ink">‹</button>
            <div className="flex items-center gap-2">
              <select aria-label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold">{MONTHS.map((name, index) => <option value={index} key={name}>{name}</option>)}</select>
              <input aria-label="Year" type="number" min="1900" max="2200" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold tabular" />
            </div>
            <button aria-label="Next month" onClick={() => moveMonth(1)} className="h-9 w-9 rounded-full border border-line text-muted hover:text-ink">›</button>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
            {WEEKDAYS.map((day) => <div key={day} className="bg-surface-2 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-faint sm:text-xs">{day}</div>)}
            {cells.map((cell) => {
              const dayEvents = byDate[cell.date] ?? []; const isToday = cell.date === nzDateKey(today);
              return <div key={cell.date} role="button" tabIndex={0} aria-label={`${cell.date}, ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`} onClick={() => selectDate(cell.date)} onDoubleClick={() => createOnDate(cell.date)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectDate(cell.date); } }} className={`min-h-16 cursor-pointer overflow-hidden p-1.5 text-left align-top transition hover:bg-moss/5 sm:min-h-24 sm:p-2 ${cell.inCurrentMonth ? "bg-surface" : "bg-surface-2/55"} ${selected === cell.date ? "ring-2 ring-inset ring-moss" : ""}`}>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-moss text-white" : cell.inCurrentMonth ? "text-muted" : "text-faint"}`}>{cell.day}</span>
                <div className={`mt-1 space-y-1 ${cell.inCurrentMonth ? "" : "opacity-65"}`}>{dayEvents.slice(0, 2).map((event) => <button type="button" key={event.id} onClick={(click) => { click.stopPropagation(); setSelected(cell.date); setEditing(event); setCreating(false); }} onDoubleClick={(click) => click.stopPropagation()} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[10px] font-semibold text-white transition-opacity hover:opacity-80 ${EVENT_CATEGORY_COLOUR[event.category]}`}>{event.startTime} {event.title}</button>)}{dayEvents.length > 2 && <p className="px-1 text-[10px] font-semibold text-faint">+{dayEvents.length - 2} more</p>}</div>
              </div>;
            })}
          </div>
        </div>

        <aside className="border-t border-line-soft p-5 sm:p-6">
          <p className="eyebrow">{selected}</p><h3 className="mt-1 font-bold">Events</h3>
          <div className="mt-4 space-y-2">{selectedEvents.length ? selectedEvents.map((event) => <button key={event.id} onClick={() => { setEditing(event); setCreating(false); }} className="w-full rounded-xl border border-line-soft bg-surface-2/60 p-3 text-left hover:border-moss/40"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">{event.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${EVENT_CATEGORY_COLOUR[event.category]}`}>{CATEGORY_LABEL[event.category]}</span></div><p className="mt-1 text-xs text-muted">{event.startTime}–{event.endTime}</p>{event.location && <p className="mt-1 truncate text-xs text-faint">{event.location}</p>}</button>) : <p className="text-sm text-muted">No events. Select this date to add one.</p>}</div>
          <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => { setEditing(null); setCreating(true); }}>Add on this date</Button>
        </aside>
      </div>

      {(creating || editing) && <EventEditor initial={editing ?? { ...EMPTY, date: selected }} onCancel={() => { setCreating(false); setEditing(null); }} onDelete={editing ? () => void remove(editing.id).catch((error) => setNotice(error.message)) : undefined} onSaved={async () => { setCreating(false); setEditing(null); await load(); setNotice(editing ? "Event updated." : "Event added."); }} />}

      <div className="border-t border-line-soft bg-surface-2/40 p-5 sm:p-6">
        <p className="eyebrow">Calendar subscription</p><p className="mt-2 text-sm text-muted">Copy the link below and paste it into any calendar app that supports iCal feeds.</p>
        <div className="mt-3 flex gap-2"><input readOnly value={feedUrl} aria-label="iCal feed URL" className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-muted" /><Button size="sm" variant="outline" disabled={!feedUrl} onClick={() => void navigator.clipboard.writeText(feedUrl).then(() => setNotice("iCal link copied."))}>Copy link</Button></div>
        {notice && <p role="status" className="mt-3 text-xs font-semibold text-moss">{notice}</p>}
      </div>
    </section>
  );
}

function EventEditor({ initial, onCancel, onDelete, onSaved }: { initial: CalendarEvent | CalendarEventDraft; onCancel: () => void; onDelete?: () => void; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<CalendarEventDraft>(initial);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editingId = "id" in initial ? initial.id : null;
  const field = (key: keyof CalendarEventDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft((value) => ({ ...value, [key]: event.target.value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { await api("/api/calendar/events", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, id: editingId }) }); window.dispatchEvent(new Event("calendar-events-changed")); await onSaved(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save event."); } finally { setBusy(false); } };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}><form onSubmit={submit} className="w-full max-w-lg rounded-t-3xl border border-line bg-surface p-6 shadow-2xl sm:rounded-3xl">
    <div className="flex items-center justify-between"><div><p className="eyebrow">{editingId ? "Edit event" : "New event"}</p><h3 className="mt-1 text-xl font-bold">Event details</h3></div><button type="button" onClick={onCancel} aria-label="Close" className="h-9 w-9 rounded-full text-xl text-muted hover:bg-surface-2">×</button></div>
    <div className="mt-5 grid gap-4"><label className="text-xs font-semibold text-muted">Title<input required value={draft.title} onChange={field("title")} className="mt-1 block w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink" /></label><label className="text-xs font-semibold text-muted">Date<input required type="date" value={draft.date} onChange={field("date")} className="mt-1 block w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-muted">Starts<input required type="time" value={draft.startTime} onChange={field("startTime")} className="mt-1 block w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink" /></label><label className="text-xs font-semibold text-muted">Ends<input required type="time" value={draft.endTime} onChange={field("endTime")} className="mt-1 block w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink" /></label></div><label className="text-xs font-semibold text-muted">Category<select value={draft.category} onChange={field("category")} className="mt-1 block w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink">{EVENT_CATEGORIES.map((category) => <option value={category} key={category}>{CATEGORY_LABEL[category]}</option>)}</select></label>
      <label className="text-xs font-semibold text-muted">Location <span className="font-normal text-faint">(optional)</span><input value={draft.location} onChange={field("location")} className="mt-1 block w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink" /></label><label className="text-xs font-semibold text-muted">Description<textarea rows={3} value={draft.description} onChange={field("description")} className="mt-1 block w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink" /></label></div>
    {error && <p className="mt-3 text-xs font-semibold text-clay">{error}</p>}<div className="mt-5 flex gap-2">{onDelete && <Button type="button" variant="danger" onClick={() => setConfirmingDelete(true)}>Delete</Button>}<Button type="button" variant="ghost" className="ml-auto" onClick={onCancel}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save event"}</Button></div>
    {confirmingDelete && onDelete && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 p-6 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmingDelete(false); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-event-title" aria-describedby="delete-event-description" className="card w-full max-w-sm p-6 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-clay/15 text-xl font-bold text-clay">!</div>
        <h3 id="delete-event-title" className="mt-4 text-xl font-bold">Delete event?</h3>
        <p id="delete-event-description" className="mt-2 text-sm leading-6 text-muted">Are you sure you want to delete this event?</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
          <Button type="button" variant="danger" onClick={onDelete}>Delete</Button>
        </div>
      </div>
    </div>}
  </form></div>;
}
