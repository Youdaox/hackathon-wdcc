"use client";

import { useState } from "react";
import { useIncline } from "@/lib/store";
import { MOOD_LABEL, faceFor, levelProgress, moodFor } from "@/lib/companion";
import { formatCompact } from "@/lib/time";
import type { Mood } from "@/lib/types";

const MOOD_ACCENT: Record<Mood, string> = {
  happy: "text-moss",
  neutral: "text-citrus",
  sad: "text-amber",
  sick: "text-clay",
};

const HP_BAR: Record<Mood, string> = {
  happy: "bg-moss",
  neutral: "bg-citrus",
  sad: "bg-amber",
  sick: "bg-clay",
};

export function CompanionCard() {
  const { companion, active, renameCompanion } = useIncline();
  const [editing, setEditing] = useState(false);
  const mood = moodFor(companion.hp);
  const progress = levelProgress(companion);
  const distracted = Boolean(active?.isHidden);

  return (
    <section className="card flex flex-col items-center p-8 text-center">
      {/* Creature stage */}
      <div className="relative flex h-44 w-full items-center justify-center">
        <div
          className="absolute h-32 w-32 rounded-full blur-3xl transition-colors duration-700"
          style={{
            background: distracted
              ? "rgba(238,124,99,0.35)"
              : mood === "happy"
                ? "rgba(111,221,160,0.35)"
                : "rgba(217,232,110,0.2)",
          }}
        />
        <span
          className={`relative select-none text-[7rem] leading-none ${
            distracted ? "animate-shiver" : active ? "animate-breathe" : ""
          }`}
          role="img"
          aria-label={`${companion.name} is ${MOOD_LABEL[mood].toLowerCase()}`}
        >
          {faceFor(mood, companion.level)}
        </span>
      </div>

      {editing ? (
        <input
          autoFocus
          defaultValue={companion.name}
          onBlur={(e) => {
            renameCompanion(e.target.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-40 rounded-lg border border-line bg-canvas px-2 py-1 text-center font-display text-2xl font-bold text-ink focus:border-moss focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="font-display text-2xl font-bold transition-colors hover:text-moss"
          title="Rename"
        >
          {companion.name}
        </button>
      )}

      <p className={`mt-1 text-sm font-semibold ${MOOD_ACCENT[mood]}`}>
        Level {companion.level} · {MOOD_LABEL[mood]}
      </p>

      <div className="mt-6 w-full space-y-4">
        <Meter
          label="XP"
          value={`${progress.xp} / ${progress.needed}`}
          pct={progress.pct}
          barClass="bg-moss"
        />
        <Meter
          label="Health"
          value={`${Math.round(companion.hp)}%`}
          pct={companion.hp}
          barClass={HP_BAR[mood]}
        />
      </div>

      <p className="mt-6 text-xs text-faint">
        {formatCompact(companion.totalFocusedMs)} of verified focus, all time
      </p>
    </section>
  );
}

function Meter({
  label,
  value,
  pct,
  barClass,
}: {
  label: string;
  value: string;
  pct: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="tabular text-xs font-semibold text-muted">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${barClass}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
