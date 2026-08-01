"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveSession, AwayReason, FocusSession } from "@/lib/types";
import { RULES } from "@/lib/companion";
import { uid } from "@/lib/storage";

export const LIVE_SESSION_KEY = "incline.activeSession.v1";
/** A restored session with a gap longer than this is treated as abandoned. */
const RESUME_CUTOFF_MS = 10 * 60_000;

export interface StartSessionInput {
  title: string;
  course: string;
  blockId?: string | null;
  /** Planned length in minutes; omit for an open-ended session. */
  plannedMinutes?: number | null;
}

interface Persisted {
  session: ActiveSession;
  lastFlushAt: number;
}

/** The user is away if *either* signal says so. */
function isAway(session: Pick<ActiveSession, "isHidden" | "isGazeAway">): boolean {
  return session.isHidden || session.isGazeAway;
}

/**
 * Runs one focus session and measures it with the Page Visibility API plus, if
 * the user opted in, eye tracking.
 *
 * Accounting is timestamp-based rather than tick-based: every flush moves the
 * real elapsed time into either `focusedMs` or `distractedMs`, and we flush on
 * `visibilitychange` as well as on the 1s interval. That matters because
 * browsers throttle timers in background tabs — without the visibility flush a
 * hidden tab would under-report distraction.
 *
 * The two away signals are deliberately OR-ed into one state rather than
 * tracked separately: switching tabs *while* looking away is one distraction,
 * not two, and the user only ever sees one timer.
 */
export function useFocusSession(onComplete: (session: FocusSession) => void) {
  const [active, setActive] = useState<ActiveSession | null>(null);
  /** Clock sampled on each tick; keeps `Date.now()` out of the render path. */
  const [now, setNow] = useState(0);

  const lastFlushAt = useRef<number>(0);
  const activeRef = useRef<ActiveSession | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Refs are synced in effects, never during render, so they always reflect
  // the last committed state by the time a timer or handler reads them.
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  /** Moves elapsed time since the last flush into the right bucket. */
  const flush = useCallback((at: number) => {
    setActive((prev) => {
      if (!prev) return prev;
      const delta = Math.max(0, at - lastFlushAt.current);
      lastFlushAt.current = at;
      if (delta === 0) return prev;
      return isAway(prev)
        ? { ...prev, distractedMs: prev.distractedMs + delta }
        : { ...prev, focusedMs: prev.focusedMs + delta };
    });
  }, []);

  /**
   * Banks the elapsed time against the state we were *just* in, then applies a
   * change to one of the away signals — opening or closing a distraction event
   * if that flips the combined state.
   *
   * Both signals funnel through here so the "when did this stretch start"
   * bookkeeping exists exactly once.
   */
  const applyAway = useCallback((patch: Partial<ActiveSession>, reason: AwayReason) => {
    const at = Date.now();
    setNow(at);
    setActive((prev) => {
      if (!prev) return prev;
      const changed = Object.entries(patch).some(
        ([key, value]) => prev[key as keyof ActiveSession] !== value,
      );
      if (!changed) return prev;

      const delta = Math.max(0, at - lastFlushAt.current);
      lastFlushAt.current = at;
      const wasAway = isAway(prev);
      const next: ActiveSession = {
        ...prev,
        ...patch,
        focusedMs: prev.focusedMs + (wasAway ? 0 : delta),
        distractedMs: prev.distractedMs + (wasAway ? delta : 0),
      };

      if (isAway(next) === wasAway) return next;
      if (isAway(next)) return { ...next, awaySince: at, awayReason: reason };

      const startedAt = prev.awaySince ?? at;
      const durationMs = at - startedAt;
      return {
        ...next,
        awaySince: null,
        awayReason: null,
        distractions: [
          ...prev.distractions,
          {
            startedAt,
            durationMs,
            penalized: durationMs >= RULES.graceMs,
            reason: prev.awayReason ?? reason,
          },
        ],
      };
    });
  }, []);

  /** Called by the eye tracker when the gaze debounce flips. */
  const setGazeAway = useCallback(
    (away: boolean) => applyAway({ isGazeAway: away }, "gaze"),
    [applyAway],
  );

  const start = useCallback((input: StartSessionInput) => {
    const at = Date.now();
    lastFlushAt.current = at;
    const hidden = document.hidden;
    setNow(at);
    setActive({
      id: uid(),
      blockId: input.blockId ?? null,
      title: input.title,
      course: input.course,
      startedAt: at,
      plannedMs: input.plannedMinutes ? input.plannedMinutes * 60_000 : null,
      focusedMs: 0,
      distractedMs: 0,
      distractions: [],
      isHidden: hidden,
      isGazeAway: false,
      awaySince: hidden ? at : null,
      awayReason: hidden ? "hidden" : null,
      bonusXp: 0,
    });
  }, []);

  /** Adds flat XP to the running session (correct recall check). */
  const addBonusXp = useCallback((amount: number) => {
    setActive((prev) => (prev ? { ...prev, bonusXp: prev.bonusXp + amount } : prev));
  }, []);

  const clearLive = useCallback(() => {
    setActive(null);
    activeRef.current = null;
    lastFlushAt.current = 0;
    window.localStorage.removeItem(LIVE_SESSION_KEY);
  }, []);

  const end = useCallback(() => {
    const at = Date.now();
    const current = activeRef.current;
    if (!current) return;

    // Final flush straight from the last committed state, plus close out an
    // open away stretch if we're ending mid-distraction.
    const delta = Math.max(0, at - lastFlushAt.current);
    const away = isAway(current);
    const focusedMs = current.focusedMs + (away ? 0 : delta);
    const distractedMs = current.distractedMs + (away ? delta : 0);
    const distractions = [...current.distractions];
    if (away && current.awaySince !== null) {
      const durationMs = at - current.awaySince;
      distractions.push({
        startedAt: current.awaySince,
        durationMs,
        penalized: durationMs >= RULES.graceMs,
        reason: current.awayReason ?? "hidden",
      });
    }

    const finished: FocusSession = {
      id: current.id,
      blockId: current.blockId,
      title: current.title,
      course: current.course,
      startedAt: current.startedAt,
      endedAt: at,
      totalMs: at - current.startedAt,
      focusedMs,
      distractedMs,
      distractions,
      xpEarned: 0, // filled in by the companion layer
      hpDelta: 0,
      xpMultiplier: 1,
      bonusXp: current.bonusXp,
    };

    clearLive();
    onCompleteRef.current(finished);
  }, [clearLive]);

  // --- Visibility: the always-on distraction signal --------------------------
  useEffect(() => {
    const handleVisibility = () => applyAway({ isHidden: document.hidden }, "hidden");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [applyAway]);

  // --- Tick -----------------------------------------------------------------
  // Keyed on whether a session exists, not on `active` itself, so the interval
  // isn't torn down and rebuilt on every one-second state change.
  const isRunning = active !== null;
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      const at = Date.now();
      const current = activeRef.current;
      // Auto-complete a planned session. `end` does its own final flush, so
      // returning before `flush` here avoids double-counting the last second.
      if (current?.plannedMs && at - current.startedAt >= current.plannedMs) {
        end();
        return;
      }
      flush(at);
      setNow(at);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRunning, flush, end]);

  // --- Crash/refresh resilience ---------------------------------------------
  useEffect(() => {
    if (!active) return;
    const payload: Persisted = { session: active, lastFlushAt: lastFlushAt.current };
    window.localStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(payload));
  }, [active]);

  // localStorage can only be read after hydration, so restoring state here is
  // unavoidable — and it runs at most once, on mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const raw = window.localStorage.getItem(LIVE_SESSION_KEY);
    if (!raw) return;
    try {
      const { session, lastFlushAt: savedFlush } = JSON.parse(raw) as Persisted;
      const gap = Date.now() - savedFlush;
      if (gap > RESUME_CUTOFF_MS) {
        window.localStorage.removeItem(LIVE_SESSION_KEY);
        return;
      }
      // The tab was gone, so the gap counts as time away — the same rule as any
      // other distraction, which keeps things honest across a refresh.
      const distractions = [...session.distractions];
      if (gap >= RULES.graceMs) {
        distractions.push({
          startedAt: savedFlush,
          durationMs: gap,
          penalized: true,
          reason: "hidden",
        });
      }
      const at = Date.now();
      lastFlushAt.current = at;
      setNow(at);
      setActive({
        ...session,
        bonusXp: session.bonusXp ?? 0, // tolerate sessions saved before this field existed
        distractedMs: session.distractedMs + gap,
        distractions,
        isHidden: document.hidden,
        // Tracking restarts from scratch after a reload, so the gaze signal
        // resets to "present" until the camera is back up.
        isGazeAway: false,
        awaySince: document.hidden ? at : null,
        awayReason: document.hidden ? "hidden" : null,
      });
    } catch {
      window.localStorage.removeItem(LIVE_SESSION_KEY);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const elapsedMs = active ? Math.max(0, now - active.startedAt) : 0;

  return { active, start, end, cancel: clearLive, elapsedMs, addBonusXp, setGazeAway };
}
