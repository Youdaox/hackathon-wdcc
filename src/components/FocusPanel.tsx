"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useIncline } from "@/lib/store";
import { useNow } from "@/hooks/useNow";
import { findActiveBlock, findNextBlock, formatCountdown } from "@/lib/schedule";
import { DAY_LABELS, formatClock, formatCompact, formatDuration } from "@/lib/time";

const QUICK_DURATIONS = [15, 25, 50];

export function FocusPanel() {
  const { blocks, active, elapsedMs, startSession, endSession, cancelSession } = useIncline();
  // Ticks every 15s so "next up · in 24m" counts down on screen.
  const now = useNow();

  if (active) {
    return (
      <LiveSession
        onEnd={endSession}
        onCancel={cancelSession}
        elapsedMs={elapsedMs}
        {...{ active }}
      />
    );
  }


  const current = now ? findActiveBlock(blocks, now) : null;
  const next = now ? findNextBlock(blocks, now) : null;

  return (
    <section className="card relative overflow-hidden p-8">
      <div className="eyebrow">Focus session</div>

      {current ? (
        <>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight">{current.block.title}</h2>
          <p className="mt-1.5 text-sm text-muted">
            <span className="font-medium text-moss">In session now</span> · {current.block.course} ·
            ends {formatClock(current.block.endMin)}
          </p>
          <Button
            size="lg"
            className="mt-6"
            onClick={() =>
              startSession({
                title: current.block.title,
                course: current.block.course,
                blockId: current.block.id,
                plannedMinutes: current.minutesUntilEnd,
              })
            }
          >
            Start {current.minutesUntilEnd}-minute session
          </Button>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight">
            {next ? "Nothing running yet" : "No schedule yet"}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {next ? (
              <>
                Next up: <span className="text-ink">{next.block.title}</span> ·{" "}
                {DAY_LABELS[next.day]} {formatClock(next.block.startMin)} ·{" "}
                {formatCountdown(next.minutesUntilStart)}
              </>
            ) : (
              "Add a study block, or just start a free session below."
            )}
          </p>
        </>
      )}

      <div className="mt-7 border-t border-line-soft pt-6">
        <div className="eyebrow mb-3">Or start a free session</div>
        <div className="flex flex-wrap gap-2">
          {QUICK_DURATIONS.map((minutes) => (
            <Button
              key={minutes}
              variant="outline"
              onClick={() =>
                startSession({
                  title: "Free focus",
                  course: next?.block.course ?? "General study",
                  plannedMinutes: minutes,
                })
              }
            >
              {minutes} min
            </Button>
          ))}
          <Button
            variant="ghost"
            onClick={() =>
              startSession({
                title: "Open session",
                course: next?.block.course ?? "General study",
                plannedMinutes: null,
              })
            }
          >
            Open-ended
          </Button>
        </div>
      </div>
    </section>
  );
}

interface LiveProps {
  active: NonNullable<ReturnType<typeof useIncline>["active"]>;
  elapsedMs: number;
  onEnd: () => void;
  onCancel: () => void;
}

function LiveSession({ active, elapsedMs, onEnd, onCancel }: LiveProps) {
  const { currentZone } = useIncline();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const focusRatio =
    active.focusedMs + active.distractedMs > 0
      ? active.focusedMs / (active.focusedMs + active.distractedMs)
      : 1;
  const remainingMs = active.plannedMs ? Math.max(0, active.plannedMs - elapsedMs) : null;
  const penalized = active.distractions.filter((d) => d.penalized).length;

  return (
    <section
      className={`card relative overflow-hidden p-8 transition-colors ${
        active.isHidden ? "border-clay/60" : "border-moss/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">{active.course}</div>
          <h2 className="mt-2 text-2xl font-extrabold">{active.title}</h2>
        </div>
        <span
          className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            active.isHidden ? "bg-clay/15 text-clay" : "bg-moss/15 text-moss"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${active.isHidden ? "bg-clay" : "animate-pulse bg-moss"}`}
          />
          {active.isHidden ? "Away" : "Focused"}
        </span>
      </div>

      <div className="mt-8 text-center">
        <div className="eyebrow">{remainingMs !== null ? "Time remaining" : "Elapsed"}</div>
        <div
          className={`tabular mt-1 font-mono text-[5.5rem] font-bold leading-none tracking-tight ${
            active.isHidden ? "text-clay" : "text-ink"
          }`}
        >
          {formatDuration(remainingMs ?? elapsedMs)}
        </div>
      </div>

      {/* Focused vs distracted, as one continuous bar. */}
      <div className="mt-8">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="bg-moss transition-[width] duration-1000 ease-linear"
            style={{ width: `${focusRatio * 100}%` }}
          />
          <div className="flex-1 bg-clay/70" />
        </div>
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-moss">
            <span className="tabular font-semibold">{formatCompact(active.focusedMs)}</span>{" "}
            <span className="text-muted">focused</span>
          </span>
          <span className="text-clay">
            <span className="tabular font-semibold">{formatCompact(active.distractedMs)}</span>{" "}
            <span className="text-muted">away</span>
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-1.5">
        {currentZone && (
          <span className="tabular rounded-full bg-citrus/15 px-3 py-1 text-xs font-bold text-citrus">
            {currentZone.multiplier}× XP · {currentZone.name}
          </span>
        )}
        {penalized > 0 && (
          <p className="text-xs text-amber">
            {penalized} distraction{penalized === 1 ? "" : "s"} logged this session
          </p>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center gap-3">
        <Button size="lg" onClick={onEnd}>
          End session
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (confirmDiscard ? onCancel() : setConfirmDiscard(true))}
          onBlur={() => setConfirmDiscard(false)}
        >
          {confirmDiscard ? "Discard — sure?" : "Discard"}
        </Button>
      </div>

      {active.isHidden && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-clay/10 py-2 text-center text-xs font-semibold text-clay">
          Tab hidden — this time isn&apos;t counting
        </div>
      )}
    </section>
  );
}
