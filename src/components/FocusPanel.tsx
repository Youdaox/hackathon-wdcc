"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GazeCalibrationOverlay } from "@/components/GazeCalibration";
import { FocusTimeline } from "@/components/FocusTimeline";
import { useIncline } from "@/lib/store";
import { useNow } from "@/hooks/useNow";
import { findActiveBlock, findNextBlock, formatCountdown } from "@/lib/schedule";
import { DAY_LABELS, formatClock, formatCompact, formatDuration } from "@/lib/time";
import { awayMsPastGrace, hpLostForAwayMs } from "@/lib/companion";
import { useStudyMemory } from "@/lib/study-memory/client";

const QUICK_DURATIONS = [15, 25, 50];

/** How long the "you were away" receipt stays up after the user returns. */
const RECEIPT_MS = 12_000;

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

      <EyeTrackingToggle />
      <StudyMemoryToggle />
    </section>
  );
}

function StudyMemoryToggle() {
  const { available, enabled, setEnabled, sources, sourceId, setSourceId, refreshSources } = useStudyMemory();
  return (
    <div className="mt-5 border-t border-line-soft pt-5">
      <div className="flex items-start justify-between gap-4">
        <div><div className="text-sm font-semibold">AI Study Memory</div><p className="mt-0.5 max-w-lg text-xs text-muted">With your consent, Incline samples the selected screen only during focus mode, sends useful frames to OpenAI, and deletes each frame immediately after processing.</p></div>
        <Button size="sm" variant={enabled ? "ghost" : "outline"} disabled={!available} onClick={() => setEnabled(!enabled)}>{enabled ? "Turn off" : available ? "Enable" : "Desktop app only"}</Button>
      </div>
      {enabled && <div className="mt-3">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-semibold text-muted" htmlFor="capture-source">Capture source</label>
          <button type="button" onClick={refreshSources} className="text-[11px] font-semibold text-moss hover:text-moss-deep">Refresh windows</button>
        </div>
        <select id="capture-source" value={sourceId} onFocus={refreshSources} onChange={(event) => setSourceId(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
        </select>
        <span className="mt-1 block text-[11px] font-normal text-faint">Avoid selecting windows containing messages, passwords, health, banking, or personal records.</span>
      </div>}
    </div>
  );
}

/**
 * Opt-in for the webcam. Deliberately worded around what actually happens —
 * the camera opens only during a session and no video leaves the device.
 */
function EyeTrackingToggle() {
  const { eyeEnabled, setEyeEnabled, gazeCalibration, setGazeCalibration } = useIncline();

  return (
    <div className="mt-6 flex items-start justify-between gap-4 border-t border-line-soft pt-5">
      <div className="min-w-0">
        <div className="text-sm font-semibold">Eye tracking</div>
        <p className="mt-0.5 text-xs text-muted">
          {eyeEnabled
            ? "Your webcam opens when a session starts and closes when it ends. Frames are processed on your device only."
            : "Use your webcam to notice when your eyes wander off screen."}
        </p>
        {eyeEnabled && gazeCalibration !== "none" && (
          <button
            onClick={() => setGazeCalibration("none")}
            className="mt-1.5 text-[11px] font-semibold text-faint transition-colors hover:text-muted"
          >
            {gazeCalibration === "done" ? "Recalibrate" : "Calibrate for better accuracy"}
          </button>
        )}
      </div>
      <Button
        size="sm"
        variant={eyeEnabled ? "ghost" : "outline"}
        onClick={() => setEyeEnabled(!eyeEnabled)}
      >
        {eyeEnabled ? "Turn off" : "Turn on"}
      </Button>
    </div>
  );
}

interface LiveProps {
  active: NonNullable<ReturnType<typeof useIncline>["active"]>;
  elapsedMs: number;
  onEnd: () => void;
  onCancel: () => void;
}

function LiveSession({ active, elapsedMs, onEnd, onCancel }: LiveProps) {
  const { companion, currentZone, eyeEnabled, gazeStatus, gazeCalibration, gazeEpisodes, gazeReason } =
    useIncline();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const memory = useStudyMemory();
  const away = active.isHidden || active.isGazeAway;
  const remainingMs = active.plannedMs ? Math.max(0, active.plannedMs - elapsedMs) : null;
  const penalized = active.distractions.filter((d) => d.penalized).length;

  // The receipt for the lapse just ended. Shown briefly and only once the user
  // is actually back — a permanent banner would stop being news, and one shown
  // while still away would be competing with the surfaces that can be seen from
  // outside the page.
  const now = active.startedAt + elapsedMs;
  const activeAwayIsPenalized = away
    && active.awaySince !== null
    && awayMsPastGrace(now - active.awaySince) > 0;
  const showTimeline = penalized > 0 || activeAwayIsPenalized;
  const recent = active.distractions.at(-1);
  const lastLapse =
    !away && recent && now - (recent.startedAt + recent.durationMs) <= RECEIPT_MS ? recent : null;

  return (
    <section
      className={`card relative overflow-hidden p-8 transition-colors ${
        away ? "border-clay/60" : "border-moss/30"
      }`}
    >
      {/* Only asked for once, and only while the camera is actually coming up. */}
      {gazeCalibration === "none" && (gazeStatus === "loading" || gazeStatus === "tracking") && (
        <GazeCalibrationOverlay />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow">{active.course}</div>
          <h2 className="mt-2 text-2xl font-extrabold">{active.title}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              away ? "bg-clay/15 text-clay" : "bg-moss/15 text-moss"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${away ? "bg-clay" : "animate-pulse bg-moss"}`}
            />
            {active.isHidden
              ? "Away"
              : active.isGazeAway
                ? // "Eyes off screen" was asserted for every cause, including the
                  // user having walked out of frame entirely. Name what was
                  // actually detected, and fall back only when it's since changed.
                  (gazeReason && REASON_COPY[gazeReason]) || "Not focused"
                : "Focused"}
          </span>
          {eyeEnabled && <GazeStatusChip status={gazeStatus} calibration={gazeCalibration} />}
        </div>
      </div>

      {/* Held back until there's something to say — a timeline of the first ten
          seconds of a session is noise, and "no lapses in the whole 12s" reads
          as faint praise. */}
      <div className="mt-8 text-center">
        <div className="eyebrow">{remainingMs !== null ? "Time remaining" : "Elapsed"}</div>
        <div
          className={`tabular mt-1 font-mono text-[5.5rem] font-bold leading-none tracking-tight ${
            away ? "text-clay" : "text-ink"
          }`}
        >
          {formatDuration(remainingMs ?? elapsedMs)}
        </div>
      </div>

      {showTimeline && (
        <div className="mt-7 border-t border-line-soft pt-6">
          <FocusTimeline
            startedAt={active.startedAt}
            endedAt={active.startedAt + elapsedMs}
            distractions={active.distractions}
            openAwaySince={active.awaySince}
            openAwayReason={active.awayReason}
          />
        </div>
      )}

      <div className="mt-4 flex flex-col items-center gap-1.5">
        {memory.enabled && memory.available && (
          <button onClick={memory.state === "paused" ? memory.resume : memory.pause} className="rounded-full bg-citrus/15 px-3 py-1 text-xs font-bold text-citrus">
            {memory.state === "paused" ? "Resume Study Memory" : `Study Memory on · ${memory.captures} captured · Pause`}
          </button>
        )}
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
        {gazeEpisodes > 0 && !active.isGazeAway && (
          <p className="text-xs text-faint">
            Eyes drifted {gazeEpisodes} time{gazeEpisodes === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* The warning. Loud on purpose — it has to land in peripheral vision,
          because by definition the user isn't looking straight at it. */}
      {active.isGazeAway && (
        <div className="animate-rise mt-6 flex items-center gap-3 rounded-xl border border-clay/50 bg-clay/10 px-4 py-3">
          <span className="text-xl">👀</span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-clay">
              {gazeReason === "absent"
                ? "Come back to your session"
                : gazeReason === "eyes-closed"
                  ? "Still with us?"
                  : "Eyes back on the screen"}
            </div>
            <div className="text-xs text-muted">
              This time is counting as distraction until you&apos;re back.
            </div>
          </div>
        </div>
      )}

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

      {/* A receipt, not a warning. The old banner here read "Tab hidden — this
          time isn't counting", which is only ever rendered while the tab is
          hidden and therefore could never be read while it was true. What an
          in-page surface is actually good for is telling you what you missed —
          the live warning now lives in the tab title and the desktop pill. */}
      {lastLapse && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-clay/10 py-2 text-center text-xs font-semibold text-clay">
          You were away {formatCompact(lastLapse.durationMs)}
          {lastLapse.penalized
            ? ` — that cost ${companion.name} ${hpLostForAwayMs(
                awayMsPastGrace(lastLapse.durationMs),
              ).toFixed(1)} HP`
            : " — inside the grace window, no harm done"}
        </div>
      )}
    </section>
  );
}

/** What the live signal is doing, in the user's terms rather than the tracker's. */
const REASON_COPY: Record<NonNullable<ReturnType<typeof useIncline>["gazeReason"]>, string> = {
  absent: "Can't see you",
  turned: "Head turned away",
  "eyes-closed": "Eyes closed",
  "off-screen": "Looking off screen",
};

export function CameraOverlay() {
  const { active, eyeEnabled, gazeStatus, gazeCalibration, gazePoint, gazeReason, gazeWandering } =
    useIncline();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  if (!eyeEnabled || !active) return null;

  const statusLabel =
    gazeStatus === "tracking"
      ? gazeCalibration === "done"
        ? "Tracking"
        : "Watching"
      : gazeStatus === "loading"
        ? "Starting camera"
        : gazeStatus === "denied"
          ? "Camera blocked"
          : gazeStatus === "unsupported"
            ? "No camera"
            : gazeStatus === "error"
              ? "Camera unavailable"
              : "Idle";

  // Only the calibrated regression produces a coordinate worth drawing. Before
  // the dots are done the tracker is running on head pose alone, and plotting an
  // untrained prediction would be inventing precision we explicitly don't have.
  const showDot = gazeCalibration === "done" && gazePoint !== null;
  const measured = viewport.width > 0 && viewport.height > 0;

  // The previous version clamped these to the box, which erased the single
  // thing this panel exists to show — a gaze leaving the screen looked
  // identical to a gaze resting on the edge. So "outside" is judged on the true
  // fraction, and only the *drawn* position is clamped, into the frame's
  // padding rather than onto its edge. Predictions can land hundreds of pixels
  // past the viewport, and an genuinely unclamped dot would sail off across the
  // page.
  const fx = showDot && measured ? gazePoint.x / viewport.width : 0.5;
  const fy = showDot && measured ? gazePoint.y / viewport.height : 0.5;
  const outside = fx < 0 || fx > 1 || fy < 0 || fy > 1;
  const inGutter = (f: number) => Math.min(1.09, Math.max(-0.09, f));

  const statusTone = gazeWandering
    ? "bg-clay"
    : gazeReason
      ? "bg-amber"
      : gazeStatus === "tracking"
        ? "bg-moss"
        : "bg-citrus";

  const caption = gazeReason
    ? REASON_COPY[gazeReason]
    : showDot
      ? "Eyes on screen"
      : gazeStatus === "tracking"
        ? "Watching your head position"
        : "Waiting for the camera";

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 w-57.5 rounded-2xl border border-white/10 bg-slate-950/75 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-faint">
            Camera
          </div>
          <div className="mt-0.5 text-sm font-semibold text-ink">{statusLabel}</div>
        </div>
        <span className={`h-2.5 w-2.5 rounded-full ${statusTone}`} />
      </div>

      {/* The screen map. Padded, so a gaze that lands just off the screen has
          somewhere to be drawn instead of being squashed against the frame. */}
      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
        <div
          className="relative"
          // Matches the real viewport's shape rather than a hardcoded 16:9.
          // A fixed ratio silently distorted every position on any window that
          // wasn't widescreen — the dot drifted further from truth the further
          // the window got from 16:9.
          style={{ aspectRatio: measured ? `${viewport.width} / ${viewport.height}` : "16 / 9" }}
        >
          <div className="absolute inset-0 rounded-lg border border-white/25 bg-surface-2/90">
            <div className="absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_55%)]" />
          </div>

          {showDot ? (
            <span
              className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-[left,top] duration-150 ease-out ${
                outside
                  ? "border-clay bg-clay/80 shadow-[0_0_0_4px_rgba(200,90,60,0.22)]"
                  : "border-white bg-citrus shadow-[0_0_0_4px_rgba(255,203,70,0.18)]"
              }`}
              // Overflow is deliberately not hidden: the dot is allowed to sit
              // outside the frame, because that is exactly what it means.
              style={{ left: `${inGutter(fx) * 100}%`, top: `${inGutter(fy) * 100}%` }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] leading-snug text-faint">
              {gazeStatus === "loading"
                ? "Starting camera…"
                : gazeStatus === "tracking"
                  ? "Calibrate to see where you're looking"
                  : "No gaze data"}
            </div>
          )}
        </div>
      </div>

      <div className={`mt-2 text-[11px] ${gazeReason ? "text-clay" : "text-faint"}`}>{caption}</div>
    </div>
  );
}

/** Small, quiet line about what the camera is doing. Never blocks anything. */
function GazeStatusChip({
  status,
  calibration,
}: {
  status: ReturnType<typeof useIncline>["gazeStatus"];
  calibration: ReturnType<typeof useIncline>["gazeCalibration"];
}) {
  const LABELS: Record<typeof status, string | null> = {
    off: null,
    loading: "Starting camera…",
    tracking: calibration === "done" ? "Eye tracking on" : "Watching for you to look away",
    denied: "Camera blocked",
    unsupported: "No camera",
    error: "Camera unavailable",
  };

  const label = LABELS[status];
  if (!label) return null;

  const warn = status === "denied" || status === "error" || status === "unsupported";
  return (
    <span className={`text-[11px] font-semibold ${warn ? "text-amber" : "text-faint"}`}>
      {label}
    </span>
  );
}
