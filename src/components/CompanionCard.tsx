"use client";

import { useState } from "react";
import { useIncline } from "@/lib/store";
import { MOOD_LABEL, levelProgress, moodFor } from "@/lib/companion";
import { formatCompact } from "@/lib/time";
import { Pig, PIG_ACCESSORIES, PIG_COLORS } from "@/components/Pig";
import type { Mood, PigAccessory, PigColor } from "@/lib/types";

const ACCESSORY_ICON: Record<PigAccessory, string> = {
  none: "—",
  glasses: "😎",
  flower: "🌸",
};

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
  const { companion, active, renameCompanion, setCompanionColor, setCompanionAccessory } =
    useIncline();
  const [editing, setEditing] = useState(false);
  const mood = moodFor(companion.hp);
  const progress = levelProgress(companion);
  const distracted = Boolean(active?.isHidden);

  return (
    <section className="card flex flex-col items-center p-8 text-center">
      {/* Creature stage */}
      <div className={`relative flex h-44 w-full items-center justify-center ${distracted ? "animate-shiver" : ""}`}>
        <div
          className="absolute h-32 w-32 rounded-full blur-3xl transition-colors duration-700"
          style={{
            background: distracted
              ? "rgba(207,106,80,0.28)"
              : mood === "happy"
                ? "rgba(79,158,116,0.26)"
                : "rgba(207,154,52,0.16)",
          }}
        />
        <div className="relative" aria-label={`${companion.name} is ${MOOD_LABEL[mood].toLowerCase()}`}>
          <Pig
            mood={mood}
            level={companion.level}
            color={companion.color}
            accessory={companion.accessory}
            hp={companion.hp}
            animated={Boolean(active)}
          />
        </div>
      </div>

      <ColorPicker value={companion.color} onChange={setCompanionColor} />
      <AccessoryPicker value={companion.accessory} onChange={setCompanionAccessory} />

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

function ColorPicker({
  value,
  onChange,
}: {
  value: PigColor;
  onChange: (color: PigColor) => void;
}) {
  return (
    <div className="mt-4 flex items-center gap-2" role="group" aria-label="Coat color">
      {PIG_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          title={c.label}
          aria-label={c.label}
          aria-pressed={value === c.value}
          className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
            value === c.value ? "border-ink" : "border-line"
          }`}
          style={{ backgroundColor: c.swatch }}
        />
      ))}
    </div>
  );
}

function AccessoryPicker({
  value,
  onChange,
}: {
  value: PigAccessory;
  onChange: (accessory: PigAccessory) => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-1.5" role="group" aria-label="Accessory">
      {PIG_ACCESSORIES.map((a) => (
        <button
          key={a.value}
          type="button"
          onClick={() => onChange(a.value)}
          title={a.label}
          aria-label={a.label}
          aria-pressed={value === a.value}
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm transition-transform hover:scale-110 ${
            value === a.value ? "border-ink bg-surface-2" : "border-line"
          }`}
        >
          {ACCESSORY_ICON[a.value]}
        </button>
      ))}
    </div>
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
