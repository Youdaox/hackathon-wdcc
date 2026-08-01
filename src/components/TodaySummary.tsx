"use client";

import { useIncline } from "@/lib/store";
import { formatCompact } from "@/lib/time";

export function TodaySummary() {
  const { todaysSessions, active } = useIncline();

  // Fold the in-progress session in so the numbers move live.
  const focusedMs =
    todaysSessions.reduce((sum, s) => sum + s.focusedMs, 0) + (active?.focusedMs ?? 0);
  const distractedMs =
    todaysSessions.reduce((sum, s) => sum + s.distractedMs, 0) + (active?.distractedMs ?? 0);
  const xp = todaysSessions.reduce((sum, s) => sum + s.xpEarned, 0);
  const total = focusedMs + distractedMs;
  const focusPct = total > 0 ? Math.round((focusedMs / total) * 100) : 0;

  return (
    <section className="card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Today</h2>
        {total > 0 && (
          <span className="tabular text-sm font-semibold text-moss">{focusPct}% focused</span>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No focus time logged yet today. Start a session to get moving.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Focused" value={formatCompact(focusedMs)} accent="text-moss" />
            <Stat label="Distracted" value={formatCompact(distractedMs)} accent="text-clay" />
            <Stat label="XP earned" value={String(xp)} accent="text-citrus" />
          </div>

          <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="bg-moss" style={{ width: `${focusPct}%` }} />
            <div className="flex-1 bg-clay/70" />
          </div>

          {todaysSessions.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-line-soft pt-4">
              {todaysSessions.slice(0, 4).map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted">{session.title}</span>
                  <span className="tabular shrink-0 text-xs text-faint">
                    {formatCompact(session.focusedMs)}
                  </span>
                  <span className="tabular w-12 shrink-0 text-right text-xs font-semibold text-citrus">
                    +{session.xpEarned} XP
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-3">
      <div className={`tabular font-display text-2xl font-bold ${accent}`}>{value}</div>
      <div className="eyebrow mt-0.5">{label}</div>
    </div>
  );
}
