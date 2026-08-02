import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CHECKPOINT_MIN_MS, GRACE_MS } from "./config";
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
  /** Whether this session requires the phone to remain planted face-down. */
  plantMode: boolean;
  /** True while a Plant-to-Focus session is waiting to be planted again. */
  plantPaused: boolean;
  /** Deliberate planted-to-lifted transitions during this session. */
  phonePickups: number;
  /** Set on return when the stretch was long enough to be worth asking about. */
  pending: PendingCheckpoint | null;
}

export interface FinishedSession {
  startedAt: number;
  endedAt: number;
  focusedMs: number;
  pledgeMinutes: number;
  bonusXp: number;
  plantMode: boolean;
  phonePickups: number;
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
    plantMode: false,
    plantPaused: false,
    phonePickups: 0,
    pending: null,
  };
}

/**
 * Where the live session is parked so it survives a JS reload.
 *
 * The web app persists its active session for the same reason ("written each
 * tick so a refresh mid-session doesn't lose it"). It matters more on a phone:
 * a session can outlive a reload, a crash, or the app being evicted from
 * memory while the screen is off.
 */
const STORAGE_KEY = "incline.activeSession.v1";

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
    const next = { ...ref.current, distractions: [...ref.current.distractions] };
    setState(next);
    // Fire-and-forget: losing one write is survivable, blocking the UI on
    // disk every tick is not.
    if (next.running) {
      void AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ session: next, savedAt: Date.now() }),
      ).catch(() => {});
    } else {
      void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, []);

  /**
   * Restores a session that outlived a reload.
   *
   * Time between the last write and now is credited as *away*, not focus —
   * the app wasn't on screen for it. That makes a reload behave exactly like
   * being backgrounded, including raising the check-in, which is what a deep
   * link from Shortcuts should feel like.
   */
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as { session: FocusState; savedAt: number };
        if (!parsed?.session?.running) return;

        const now = Date.now();
        const gap = Math.max(0, now - parsed.savedAt);
        const restored: FocusState = {
          ...parsed.session,
          away: false,
          plantMode: Boolean(parsed.session.plantMode),
          // A restored sensor session must be planted again before it earns
          // more focus; the raw motion stream cannot survive a JS reload.
          plantPaused: Boolean(parsed.session.plantMode),
          phonePickups: parsed.session.phonePickups ?? 0,
          distractedMs: parsed.session.distractedMs + gap,
        };

        if (gap >= CHECKPOINT_MIN_MS) {
          const index = restored.distractions.length;
          restored.distractions = [
            ...restored.distractions,
            { startedAt: parsed.savedAt, durationMs: gap },
          ];
          restored.pending = { index, startedAt: parsed.savedAt, durationMs: gap };
        }

        markRef.current = now;
        ref.current = restored;
        setState({ ...restored, distractions: [...restored.distractions] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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

    if (session.away || session.plantPaused) session.distractedMs += elapsed;
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
    (pledgeMinutes = 0, plantMode = false) => {
      const now = Date.now();
      markRef.current = now;
      ref.current = {
        ...idle(),
        running: true,
        startedAt: now,
        endsAt: pledgeMinutes > 0 ? now + pledgeMinutes * 60_000 : null,
        pledgeMinutes,
        plantMode,
        // Plant sessions only call start after the initial face-down
        // calibration has completed, so the first stretch begins active.
        plantPaused: false,
      };
      publish();
    },
    [publish],
  );

  /** Switches a Plant-to-Focus session between verified and distracted time. */
  const setPlantActive = useCallback(
    (planted: boolean) => {
      const session = ref.current;
      if (!session.running || !session.plantMode) return;
      const nextPaused = !planted;
      if (session.plantPaused === nextPaused) return;

      flush(Date.now());
      session.plantPaused = nextPaused;
      if (nextPaused) session.phonePickups += 1;
      publish();
    },
    [flush, publish],
  );

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
      plantMode: session.plantMode,
      phonePickups: session.phonePickups,
      // Sub-grace blips cost focus time but shouldn't reach the server as
      // penalties, matching the web app's forgiveness for a stray tap.
      distractions: session.distractions.filter((d) => d.durationMs >= GRACE_MS),
    };

    ref.current = idle();
    publish();
    return finished;
  }, [flush, publish]);

  return { state, start, stop, setPlantActive, resolveCheckpoint, addBonusXp };
}
