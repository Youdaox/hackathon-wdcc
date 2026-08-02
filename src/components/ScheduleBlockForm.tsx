"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DAY_LABELS, minToTimeValue, parseTimeToMin } from "@/lib/time";
import { nzParts } from "@/lib/timezone";
import { isValidRange } from "@/lib/schedule";
import type { StudyBlock } from "@/lib/types";

export interface BlockDraft {
  title: string;
  course: string;
  startMin: number;
  endMin: number;
  days: number[];
}

interface Props {
  initial?: StudyBlock;
  onSubmit: (draft: BlockDraft) => void;
  onCancel: () => void;
}

const FIELD =
  "w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-faint transition-colors focus:border-moss focus:outline-none";

export function ScheduleBlockForm({ initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [course, setCourse] = useState(initial?.course ?? "");
  const [start, setStart] = useState(minToTimeValue(initial?.startMin ?? 9 * 60));
  const [end, setEnd] = useState(minToTimeValue(initial?.endMin ?? 10 * 60));
  // Lazy so the "today" default is read once, not on every render.
  const [days, setDays] = useState<number[]>(() => initial?.days ?? [nzParts().weekday]);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const startMin = parseTimeToMin(start);
    const endMin = parseTimeToMin(end);

    if (!title.trim()) return setError("Give the block a name.");
    if (!isValidRange(startMin, endMin)) return setError("End time must be after the start time.");
    if (days.length === 0) return setError("Pick at least one day.");

    setError(null);
    onSubmit({
      title: title.trim(),
      course: course.trim() || title.trim(),
      startMin,
      endMin,
      days,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="animate-rise space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow mb-1.5 block">Block name</span>
          <input
            className={FIELD}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Algorithms lecture"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block">Course</span>
          <input
            className={FIELD}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            placeholder="COMPSCI 220"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow mb-1.5 block">Starts</span>
          <input
            type="time"
            className={`${FIELD} tabular`}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block">Ends</span>
          <input
            type="time"
            className={`${FIELD} tabular`}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>

      <div>
        <span className="eyebrow mb-1.5 block">Repeats on</span>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((label, day) => {
            const on = days.includes(day);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={on}
                className={`h-9 w-12 rounded-lg text-xs font-semibold transition-colors ${
                  on
                    ? "bg-moss text-canvas"
                    : "border border-line bg-canvas text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit">{initial ? "Save changes" : "Add block"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
