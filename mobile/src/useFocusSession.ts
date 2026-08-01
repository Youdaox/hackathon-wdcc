import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { GRACE_MS } from "./config";
import type { DistractionRecord } from "./api";

/**
 * The verification engine, ported from the web app's `useFocusSession`.
 *
 * On the web, focus is verified with the Page Visibility API — the tab being
 * visible is the only time that earns XP. React Native's AppState is the same
 * signal on a phone: "active" means Incline is the app on screen, anything
 * else means the user left. So the honesty model carries over exactly, and
 * both platforms measure the same thing.
 *
 * What does *not* carry over is enforcement. Expo Go cannot block, or even
 * name, the app the user switched to — a distraction here records that focus
 * broke and for how long, never where they went.
 *
 * Accounting is timestamp-based, not tick-based. Every flush moves *real
 * elapsed time* into either focused or distracted, and a flush happens on the
 * AppState change as well as on the 1s interval. This matters more on a phone
 * than in a browser: a backgrounded RN app has its timers suspended outright,
 * so counting ticks would under-report distraction to near zero — precisely
 * the number that has to be trustworthy.
 */

export interface FocusState {
  running: boolean;
  startedAt: number | null;
  focusedMs: number;
  distractedMs: number;
  distractions: DistractionRecord[];
  /** True while the user is away in another app. */
  away: boolean;
}

export interface FinishedSession {
  startedAt: number;
  endedAt: number;
  focusedMs: number;
  distractions: DistractionRecord[];
}

function idle(): FocusState {
  return {
    running: false,
    startedAt: null,
    focusedMs: 0,
    distractedMs: 0,
    distractions: [],
    away: false,
  };
}

export function useFocusSession() {
  /**
   * The session lives in a ref, and state is a render-only mirror.
   *
   * Two reasons it can't be state alone: the AppState listener fires outside
   * React's render cycle and would read a stale closure, and `stop()` has to
   * return final numbers synchronously — a value computed inside a setState
   * updater isn't available by the time the caller needs it.
   */
  const ref = useRef<FocusState>(idle());
  const markRef = useRef<number>(0);
  const [state, setState] = useState<FocusState>(idle);

  const publish = useCallback(() => {
    setState({ ...ref.current, distractions: [...ref.current.distractions] });
  }, []);

  /** Moves real elapsed time since the last mark into the right bucket. */
  const flush = useCallback((now: number) => {
    const session = ref.current;
    if (!session.running) return;
    const elapsed = now - markRef.current;
    if (elapsed <= 0) return;
    markRef.current = now;

    if (session.away) session.distractedMs += elapsed;
    else session.focusedMs += elapsed;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      const session = ref.current;
      if (!session.running) return;

      const now = Date.now();
      const leaving = next !== "active";

      // Settle the stretch that just ended before switching buckets, so time
      // is attributed to the state it was actually spent in.
      flush(now);

      if (leaving && !session.away) {
        session.away = true;
        session.distractions.push({ startedAt: now, durationMs: 0 });
      } else if (!leaving && session.away) {
        session.away = false;
        const last = session.distractions[session.distractions.length - 1];
        if (last && last.durationMs === 0) last.durationMs = now - last.startedAt;
      }
      publish();
    });

    return () => subscription.remove();
  }, [flush, publish]);

  // Drives the on-screen clock. Only ever runs in the foreground — the real
  // accounting is the flush on AppState change, which is why background time
  // is still counted correctly despite this interval being suspended.
  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => {
      flush(Date.now());
      publish();
    }, 1_000);
    return () => clearInterval(id);
  }, [state.running, flush, publish]);

  const start = useCallback(() => {
    const now = Date.now();
    markRef.current = now;
    ref.current = { ...idle(), running: true, startedAt: now };
    publish();
  }, [publish]);

  /** Ends the session and hands back the final numbers to sync. */
  const stop = useCallback((): FinishedSession | null => {
    const session = ref.current;
    if (!session.running) return null;

    const now = Date.now();
    flush(now);

    // Close an open distraction — stopping while away is a legitimate way to
    // end a session, and that stretch still happened.
    const last = session.distractions[session.distractions.length - 1];
    if (last && last.durationMs === 0) last.durationMs = Math.max(0, now - last.startedAt);

    const finished: FinishedSession = {
      startedAt: session.startedAt ?? now,
      endedAt: now,
      focusedMs: session.focusedMs,
      // Sub-grace blips cost focus time but shouldn't reach the server as
      // penalties, matching the web app's forgiveness for a stray tap.
      distractions: session.distractions.filter((d) => d.durationMs >= GRACE_MS),
    };

    ref.current = idle();
    publish();
    return finished;
  }, [flush, publish]);

  return { state, start, stop };
}
