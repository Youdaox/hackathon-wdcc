import { awayMsPastGrace, hpLostForAwayMs, RULES } from "@/lib/companion";
import type { ActiveSession, AwayReason } from "@/lib/types";

export type BackgroundPhase = "idle" | "focused" | "grace" | "away";

export interface BackgroundStatus {
  phase: BackgroundPhase;
  reason: AwayReason | null;
  elapsedMs: number;
  remainingMs: number | null;
  awayMs: number;
  graceRemainingMs: number;
  hpAtRisk: number;
}

export const IDLE_STATUS: BackgroundStatus = {
  phase: "idle",
  reason: null,
  elapsedMs: 0,
  remainingMs: null,
  awayMs: 0,
  graceRemainingMs: 0,
  hpAtRisk: 0,
};

export const REASON_LABEL: Record<AwayReason, string> = {
  hidden: "Tab hidden",
  gaze: "Eyes away",
};

/** Derives the compact background indicator from the same live session state that scores focus. */
export function backgroundStatus(active: ActiveSession | null, now = Date.now()): BackgroundStatus {
  if (!active) return IDLE_STATUS;

  const elapsedMs = Math.max(0, now - active.startedAt);
  const remainingMs = active.plannedMs === null ? null : Math.max(0, active.plannedMs - elapsedMs);
  const awayMs = active.awaySince === null ? 0 : Math.max(0, now - active.awaySince);

  if (active.awaySince === null) {
    return { phase: "focused", reason: null, elapsedMs, remainingMs, awayMs: 0, graceRemainingMs: 0, hpAtRisk: 0 };
  }

  if (awayMs < RULES.graceMs) {
    return {
      phase: "grace",
      reason: active.awayReason,
      elapsedMs,
      remainingMs,
      awayMs,
      graceRemainingMs: RULES.graceMs - awayMs,
      hpAtRisk: 0,
    };
  }

  return {
    phase: "away",
    reason: active.awayReason,
    elapsedMs,
    remainingMs,
    awayMs,
    graceRemainingMs: 0,
    hpAtRisk: hpLostForAwayMs(awayMsPastGrace(awayMs)) * active.hpLossMultiplier,
  };
}

export function coarseDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
