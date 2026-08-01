import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { CHECKPOINT_MIN_MS, GRACE_MS, PLEDGE_ABANDON_MS } from "./config";
import type { AwayReason, DistractionRecord } from "./api";

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

/**
 * An away-stretch the user hasn't explained yet.
 *
 * Held separately from the distraction record so the UI can ask for a guess
 * *before* revealing `durationMs` — the gap between the two is the whole point
 * of asking, and it evaporates if the real number is on screen first.
 */
export interface PendingCheckpoint {
  /** Index into `distractions`, so the answer lands on the right record. */
  index: number;
  startedAt: number;
  durationMs: number;
}

export interface FocusState {
  running: boolean;
  startedAt: number | null;
  /**
   * Absolute timestamp the session is due to end, for a pledged session.
   * Null when open-ended. Stored as a wall-clock instant rather than a
   * remaining duration so it survives the app being suspended — a countdown
   * held in memory would simply stop while backgrounded.
   */
  endsAt: number | null;
  /** Minutes pledged at start, or 0 for an open-ended session. */
  pledgeMinutes: number;
  /** Flat XP from a correct recall check. Not scaled by the location bonus. */
  bonusXp: number;
  focusedMs: number;
  distractedMs: number;
  distractions: DistractionRecord[];
  /** True while the user is away in another app. */
  away: boolean;
  /** Set on return when the stretch was long enough to be worth asking about. */
  pending: PendingCheckpoint | null;
  /**
   * Set when a pledged session was abandoned for too long. The session is over
   * — the UI reads this and syncs it as a forfeit.
   */
  abandoned: boolean;
}

export interface FinishedSession {
  startedAt: number;
  endedAt: number;
  focusedMs: number;
  pledgeMinutes: number;
  bonusXp: number;
  distractions: DistractionRecord[];
}

function idle(): FocusState {
  return {
    running: false,
    startedAt: null,
    endsAt: null,
    pledgeMinutes: 0,
    bonusXp: 0,
    focusedMs: 0,
    distractedMs: 0,
    distractions: [],
    away: false,
    pending: null,
    abandoned: false,
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

    // The session is paused while the interruption screen is up: time spent
    // answering for a lapse is neither focus nor distraction, and counting it
    // as focus would let someone farm XP by sitting on the modal.
    if (session.pending) return;

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
        const index = session.distractions.length - 1;
        const last = session.distractions[index];
        if (last && last.durationMs === 0) {
          last.durationMs = now - last.startedAt;

          // The hard rule. Only bites when stakes were taken, and it fires on
          // return rather than on a timer, because a backgrounded RN app has
          // no timers running to fire one.
          if (session.pledgeMinutes > 0 && last.durationMs >= PLEDGE_ABANDON_MS) {
            session.abandoned = true;
            publish();
            return;
          }

          // Only interrupt for a stretch worth explaining. Anything shorter is
          // already forgiven and asking about it would just be nagging.
          if (last.durationMs >= CHECKPOINT_MIN_MS) {
            session.pending = {
              index,
              startedAt: last.startedAt,
              durationMs: last.durationMs,
            };
          }
        }
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

  const start = useCallback(
    (pledgeMinutes = 0) => {
      const now = Date.now();
      markRef.current = now;
      ref.current = {
        ...idle(),
        running: true,
        startedAt: now,
        endsAt: pledgeMinutes > 0 ? now + pledgeMinutes * 60_000 : null,
        pledgeMinutes,
      };
      publish();
    },
    [publish],
  );

  /**
   * Records an intercept outcome against the session.
   *
   * Logged as a distraction with a `bypassed` flag rather than a separate
   * concept, so one payload carries both what happened and whether the pledge
   * survived it. The server decides the forfeit.
   */
  /** Adds flat XP from a correct recall answer. */
  const addBonusXp = useCallback(
    (amount: number) => {
      const session = ref.current;
      if (!session.running) return;
      session.bonusXp += amount;
      publish();
    },
    [publish],
  );

  const recordIntercept = useCallback(
    (appLabel: string | null, bypassed: boolean) => {
      const session = ref.current;
      if (!session.running) return;
      session.distractions.push({
        startedAt: Date.now(),
        durationMs: 0,
        appLabel,
        bypassed,
      });
      publish();
    },
    [publish],
  );

  /**
   * Records what the user said about an away stretch.
   *
   * The reason travels with the distraction to the server, which decides the
   * penalty — "emergency" and "task" cost nothing, "distraction" costs HP. The
   * client deliberately doesn't apply that rule itself; one copy, server-side.
   */
  const resolveCheckpoint = useCallback(
    (reason: AwayReason, guessedSeconds: number | null) => {
      const session = ref.current;
      const pending = session.pending;
      if (!pending) return;

      const record = session.distractions[pending.index];
      if (record) {
        record.reason = reason;
        record.guessedSeconds = guessedSeconds;
      }
      session.pending = null;
      publish();
    },
    [publish],
  );

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
      pledgeMinutes: session.pledgeMinutes,
      bonusXp: session.bonusXp,
      // Sub-grace blips cost focus time but shouldn't reach the server as
      // penalties, matching the web app's forgiveness for a stray tap.
      // Intercepts are kept regardless of length: a zero-duration row still
      // carries the bypass flag the pledge rule depends on.
      distractions: session.distractions.filter(
        (d) => d.durationMs >= GRACE_MS || d.appLabel != null || d.bypassed === true,
      ),
    };

    ref.current = idle();
    publish();
    return finished;
  }, [flush, publish]);

  return { state, start, stop, resolveCheckpoint, recordIntercept, addBonusXp };
}
