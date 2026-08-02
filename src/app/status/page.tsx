"use client";

import { useEffect, useState } from "react";
import {
  IDLE_STATUS,
  IDLE_MEMORY_STATUS,
  REASON_LABEL,
  coarseDuration,
  type BackgroundPhase,
  type BackgroundStatus,
  type StudyMemoryDesktopStatus,
} from "@/lib/backgroundStatus";
import { RULES } from "@/lib/companion";

/**
 * The always-on-top desktop control (380×76, see `getStatusBounds` in
 * electron/main.js). Loaded only by the Electron shell.
 *
 * It renders the status the *renderer* derived and the main process merely
 * relayed. Previously the main process worked the state out from
 * `dashboardWindow.isFocused()` and shipped Tailwind class names over IPC, which
 * meant the pill both disagreed with the session's own scoring and knew about
 * the app's stylesheet. Phase → token mapping belongs here, with the rest of the
 * design system.
 */

const PHASE_TONE: Record<BackgroundPhase, string> = {
  idle: "bg-faint",
  focused: "bg-moss",
  grace: "bg-amber",
  away: "bg-clay",
};

const PHASE_EYEBROW: Record<BackgroundPhase, string> = {
  idle: "Not tracking",
  focused: "Focused",
  grace: "Still counting",
  away: "Away",
};

export default function StatusPage() {
  const [status, setStatus] = useState<BackgroundStatus>(IDLE_STATUS);
  const [memory, setMemory] = useState<StudyMemoryDesktopStatus>(IDLE_MEMORY_STATUS);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.background = "transparent";
    body.style.background = "transparent";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const unsubscribe = window.statusAPI?.onUpdate((next) => setStatus(next));
    const unsubscribeMemory = window.statusAPI?.onMemoryUpdate((next) => setMemory(next));
    // Two frames, so the transparent background above has actually painted
    // before the main process is told it can reveal the window.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.statusAPI?.ready());
    });

    return () => {
      cancelAnimationFrame(raf);
      unsubscribe?.();
      unsubscribeMemory?.();
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <div className="h-full w-full overflow-hidden bg-transparent p-2.5">
      <div className="flex h-full items-center gap-2.5 rounded-2xl border border-white/10 bg-slate-950/90 px-4 shadow-lg backdrop-blur">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${PHASE_TONE[status.phase]} ${
            status.phase === "focused" ? "animate-pulse" : ""
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-faint">
            {/* The reason is the eyebrow while away — "Tab hidden" tells the
                user what to undo, where "Away" only tells them off. */}
            {status.reason ? REASON_LABEL[status.reason] : PHASE_EYEBROW[status.phase]}
          </div>
          <div className="truncate text-sm font-semibold text-ink">{headline(status)}</div>
          {memory.enabled && (
            <div className="mt-0.5 truncate text-[10px] font-medium text-faint">
              {memoryLine(memory)}
            </div>
          )}
        </div>

        {/* The grace window, draining. The only stretch where coming back still
            costs nothing, so it gets the one piece of motion in the pill. */}
        {status.phase === "grace" && (
          <div className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber transition-[width] duration-1000 ease-linear"
              style={{ width: `${(status.graceRemainingMs / RULES.graceMs) * 100}%` }}
            />
          </div>
        )}

        <button
          type="button"
          disabled={!memory.enabled || memory.phase === "capturing" || memory.phase === "processing"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => window.statusAPI?.requestManualCapture()}
          className={`shrink-0 rounded-xl border px-3 py-2 text-[11px] font-bold transition-colors disabled:cursor-default ${captureTone(memory)}`}
          title={memory.sourceName ? `Capture ${memory.sourceName}` : "Capture the selected study source"}
        >
          {captureLabel(memory)}
        </button>
      </div>
    </div>
  );
}

function captureLabel(memory: StudyMemoryDesktopStatus): string {
  switch (memory.phase) {
    case "capturing": return "Capturing…";
    case "processing": return "Processing…";
    case "accepted": return "Saved ✓";
    case "duplicate": return "No change";
    case "excluded": return "Blocked";
    case "error": return "Try again";
    case "paused": return "📸 Capture";
    case "ready": return "📸 Capture";
    case "off": return "Memory off";
  }
}

function captureTone(memory: StudyMemoryDesktopStatus): string {
  if (!memory.enabled || memory.phase === "off") return "border-white/10 text-faint opacity-60";
  if (memory.phase === "accepted") return "border-moss/50 bg-moss/15 text-moss";
  if (memory.phase === "excluded" || memory.phase === "error") return "border-clay/50 bg-clay/10 text-clay";
  return "border-citrus/40 bg-citrus/10 text-citrus hover:bg-citrus/20";
}

function memoryLine(memory: StudyMemoryDesktopStatus): string {
  const source = memory.sourceName ? ` · ${memory.sourceName}` : "";
  const paused = memory.automaticPaused ? "Manual only" : "Memory on";
  return `${paused} · ${memory.acceptedCaptures} saved${source}`;
}

function headline(status: BackgroundStatus): string {
  switch (status.phase) {
    case "idle":
      return "No session running";
    case "focused":
      return status.remainingMs === null
        ? `${coarseDuration(status.elapsedMs)} elapsed`
        : `${coarseDuration(status.remainingMs)} left`;
    case "grace":
      return `Back now and it's free`;
    case "away":
      // The cost is the point of the whole indicator: a number that is going up
      // while they read it is what brings someone back.
      return `${coarseDuration(status.awayMs)} · −${status.hpAtRisk.toFixed(1)} HP`;
  }
}
