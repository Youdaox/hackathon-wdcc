"use client";

import { useMemo, useState } from "react";
import { RULES } from "@/lib/companion";
import { formatCompact } from "@/lib/time";
import type { AwayReason, DistractionEvent } from "@/lib/types";

/**
 * When attention broke, laid out along the session.
 *
 * Encoding decisions worth keeping:
 *
 * - **Focused time is the track, not a series.** The data here is the lapses;
 *   focus is their absence. Drawing focus as a green fill against red lapses
 *   would put green and red side by side, which measures ΔE 5.7 under deuteranopia
 *   — below even the floor that secondary encoding can rescue. One data color on a
 *   neutral track sidesteps the whole problem and puts the emphasis where the
 *   information is.
 * - **Reason is encoded by lane, not hue.** Position survives every kind of
 *   color blindness, greyscale printing, and forced-colors mode. A second hue
 *   would not have.
 * - **Forgiven lapses are the same hue, lighter.** Penalized/forgiven is an
 *   ordered pair, so a lightness step is the honest channel for it.
 */

const LANES: { reason: AwayReason; label: string; hint: string }[] = [
  { reason: "gaze", label: "Eyes off screen", hint: "Detected by the camera" },
  { reason: "hidden", label: "Tab hidden", hint: "You switched away from the app" },
];

/** Away stretches thinner than this would be invisible; floor them so they can be seen and hovered. */
const MIN_SEGMENT_PCT = 0.6;

interface Props {
  startedAt: number;
  /** End of the window to plot — `Date.now()` for a running session. */
  endedAt: number;
  distractions: DistractionEvent[];
  /** Start of an away stretch still in progress, for the live view. */
  openAwaySince?: number | null;
  openAwayReason?: AwayReason | null;
}

interface Segment {
  key: string;
  reason: AwayReason;
  offsetMs: number;
  durationMs: number;
  penalized: boolean;
  open: boolean;
  leftPct: number;
  widthPct: number;
}

export function FocusTimeline({
  startedAt,
  endedAt,
  distractions,
  openAwaySince = null,
  openAwayReason = null,
}: Props) {
  const [showTable, setShowTable] = useState(false);
  const spanMs = Math.max(1, endedAt - startedAt);

  const segments = useMemo<Segment[]>(() => {
    const all: Array<DistractionEvent & { open?: boolean }> = [...distractions];
    if (openAwaySince !== null) {
      all.push({
        startedAt: openAwaySince,
        durationMs: Math.max(0, endedAt - openAwaySince),
        // Still running, so whether it will count is not yet decided — judged the
        // same way the session will judge it when it closes.
        penalized: endedAt - openAwaySince >= RULES.graceMs,
        reason: openAwayReason ?? "hidden",
        open: true,
      });
    }

    return all
      .map((event, index) => {
        const offsetMs = Math.max(0, event.startedAt - startedAt);
        const widthPct = Math.max(MIN_SEGMENT_PCT, (event.durationMs / spanMs) * 100);
        return {
          key: `${event.startedAt}-${index}`,
          // Sessions recorded before eye tracking existed carry no reason.
          reason: event.reason ?? "hidden",
          offsetMs,
          durationMs: event.durationMs,
          penalized: event.penalized,
          open: Boolean(event.open),
          leftPct: Math.min(100 - MIN_SEGMENT_PCT, (offsetMs / spanMs) * 100),
          widthPct,
        };
      })
      .sort((a, b) => a.offsetMs - b.offsetMs);
  }, [distractions, openAwaySince, openAwayReason, startedAt, endedAt, spanMs]);

  // Only draw a lane for a reason that actually occurred — an empty "Eyes off
  // screen" lane on a session with the camera off states something false.
  const lanes = LANES.filter((lane) => segments.some((s) => s.reason === lane.reason));
  const ticks = useMemo(() => buildTicks(spanMs), [spanMs]);
  const awayMs = segments.reduce((total, s) => total + s.durationMs, 0);

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-line-soft bg-surface-2/40 px-4 py-5 text-center">
        <div className="text-sm font-semibold text-moss">No lapses recorded</div>
        <p className="mt-1 text-xs text-muted">
          Attention held for the whole {formatCompact(spanMs)}.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="eyebrow">Attention timeline</span>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-[11px] font-semibold text-faint transition-colors hover:text-muted"
        >
          {showTable ? "Show timeline" : "Show as list"}
        </button>
      </div>

      {showTable ? (
        <SegmentTable segments={segments} />
      ) : (
        <>
          <div className="space-y-1.5">
            {lanes.map((lane) => (
              <div key={lane.reason} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-muted">
                  {lane.label}
                </span>
                <div
                  role="img"
                  aria-label={laneSummary(lane.label, segments, lane.reason)}
                  className="relative h-6 flex-1 overflow-hidden rounded-md bg-surface-2"
                >
                  {segments
                    .filter((s) => s.reason === lane.reason)
                    .map((s) => (
                      <span
                        key={s.key}
                        title={describe(s)}
                        style={{ left: `${s.leftPct}%`, width: `${s.widthPct}%` }}
                        className={`absolute inset-y-0 rounded-sm bg-clay ${
                          // Lighter for stretches short enough to be forgiven —
                          // same hue, so it reads as "less of the same thing".
                          s.penalized ? "opacity-100" : "opacity-40"
                        } ${s.open ? "animate-pulse" : ""}`}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Axis. Hairline and solid — a dashed rule would read as a threshold. */}
          <div className="mt-1.5 flex items-start gap-3">
            <span className="w-24 shrink-0" />
            <div className="relative h-4 flex-1 border-t border-line">
              {ticks.map((tick) => (
                <span
                  key={tick.ms}
                  style={{ left: `${(tick.ms / spanMs) * 100}%` }}
                  className="absolute top-0 -translate-x-1/2 text-[10px] text-faint"
                >
                  {tick.label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
        <Key className="bg-clay" label="Counted against you" />
        <Key className="bg-clay opacity-40" label={`Forgiven (under ${RULES.graceMs / 1000}s)`} />
        <span className="tabular ml-auto">
          {segments.length} lapse{segments.length === 1 ? "" : "s"} · {formatCompact(awayMs)} away
        </span>
      </div>
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}

/**
 * The table view. Not a fallback — the tooltip enhances this, never replaces it,
 * so every value on the chart is reachable without a pointer.
 */
function SegmentTable({ segments }: { segments: Segment[] }) {
  return (
    <div className="max-h-44 overflow-y-auto rounded-lg border border-line-soft">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-surface-2 text-[10px] uppercase tracking-wide text-faint">
          <tr>
            <th className="px-3 py-1.5 font-semibold">At</th>
            <th className="px-3 py-1.5 font-semibold">For</th>
            <th className="px-3 py-1.5 font-semibold">Cause</th>
            <th className="px-3 py-1.5 text-right font-semibold">Counted</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.key} className="border-t border-line-soft">
              <td className="tabular px-3 py-1.5 text-muted">{offsetLabel(s.offsetMs)}</td>
              <td className="tabular px-3 py-1.5 text-ink">{formatCompact(s.durationMs)}</td>
              <td className="px-3 py-1.5 text-muted">{labelFor(s.reason)}</td>
              <td
                className={`px-3 py-1.5 text-right font-semibold ${
                  s.penalized ? "text-clay" : "text-muted"
                }`}
              >
                {s.penalized ? "Yes" : "Forgiven"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function labelFor(reason: AwayReason): string {
  return LANES.find((l) => l.reason === reason)?.label ?? "Away";
}

function describe(s: Segment): string {
  const counted = s.open ? "in progress" : s.penalized ? "counted" : "forgiven";
  return `${labelFor(s.reason)} · ${offsetLabel(s.offsetMs)} in · ${formatCompact(
    s.durationMs,
  )} · ${counted}`;
}

function laneSummary(label: string, segments: Segment[], reason: AwayReason): string {
  const mine = segments.filter((s) => s.reason === reason);
  const total = mine.reduce((sum, s) => sum + s.durationMs, 0);
  return `${label}: ${mine.length} lapse${mine.length === 1 ? "" : "s"}, ${formatCompact(
    total,
  )} total`;
}

/** Offsets from the start read better than wall-clock times over a single session. */
function offsetLabel(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 1) return `${totalSeconds}s`;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${rest}m`;
}

/** Four-to-six round ticks, whatever the session length. */
function buildTicks(spanMs: number): { ms: number; label: string }[] {
  const steps = [30_000, 60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000, 15 * 60_000, 30 * 60_000];
  const step = steps.find((s) => spanMs / s <= 6) ?? steps[steps.length - 1];
  const ticks: { ms: number; label: string }[] = [];
  // The final tick is dropped when it would collide with the right edge.
  for (let ms = 0; ms <= spanMs - step * 0.35; ms += step) {
    ticks.push({ ms, label: ms === 0 ? "start" : offsetLabel(ms) });
  }
  // A span shorter than the smallest step leaves the axis with no labels at all,
  // which reads as a rendering fault rather than a very short session.
  if (ticks.length === 0) ticks.push({ ms: 0, label: "start" });
  return ticks;
}
