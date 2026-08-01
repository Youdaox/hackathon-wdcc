"use client";

import { useEffect, useRef, useState } from "react";
import type { GazePrediction, WebGazer } from "webgazer";

import {
  GAZE_RULES,
  isOnScreen,
  playWanderChime,
  smoothPoint,
  type GazeCalibration,
} from "@/lib/gaze";

export type GazeStatus =
  /** Not tracking — no session running, or the user hasn't opted in. */
  | "off"
  /** No camera API at all (or a non-secure context). */
  | "unsupported"
  /** Opted in; waiting on the permission prompt, the model download, and first frames. */
  | "loading"
  /** Predictions are flowing. */
  | "tracking"
  /** Camera permission was refused. */
  | "denied"
  /** Camera in use by another app, model failed to load, etc. */
  | "error";

export interface GazeState {
  status: GazeStatus;
  /** True once eyes have been off-screen long enough to count as distraction. */
  wandering: boolean;
  /** Wander episodes so far in this tracking run. */
  episodes: number;
  /** Latest prediction, viewport pixels. Null while the face is lost. */
  point: GazePrediction | null;
}

const IDLE: GazeState = { status: "off", wandering: false, episodes: 0, point: null };

/**
 * WebGazer is a module-level singleton that mutates the DOM on `begin()`, so we
 * import it once and hand the same object back to every caller. The import is
 * deferred (it pulls in TensorFlow.js) and only ever runs in the browser.
 *
 * The prebuilt bundle, not the package entry: WebGazer's ESM source imports
 * `@mediapipe/face_mesh`, which ships as a UMD script with no ESM exports, so
 * bundling from source fails. The dist build already has it resolved.
 */
let loader: Promise<WebGazer> | null = null;

function loadWebGazer(): Promise<WebGazer> {
  // The bundle assigns `module.exports.webgazer`, which surfaces as a named
  // export here or as a property of the interop default, depending on bundler.
  loader ??= import("webgazer/dist/webgazer.commonjs2.js").then((mod) => {
    const webgazer = mod.webgazer ?? mod.default?.webgazer;
    if (!webgazer?.params) throw new Error("WebGazer bundle did not export the expected object");
    // The bundled default is a relative path, which resolves against whatever
    // route the user happens to be on. These files are copied into /public.
    webgazer.params.faceMeshSolutionPath = "/mediapipe/face_mesh";
    return webgazer;
  });
  return loader;
}

function isPermissionError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError";
}

/** Tears the camera down without letting a half-initialised WebGazer throw. */
function shutdown(webgazer: WebGazer): void {
  const steps: Array<() => unknown> = [
    () => webgazer.clearGazeListener(),
    () => webgazer.pause(),
    // `end()` does not release the webcam — `stopVideo()` is what turns the
    // recording light off, and users notice if we skip it.
    () => webgazer.stopVideo(),
    () => webgazer.end(),
  ];
  for (const step of steps) {
    try {
      step();
    } catch {
      // Already torn down, or never fully started. Keep going.
    }
  }
}

/**
 * Watches the user's gaze while `enabled` is true and reports when it wanders.
 *
 * Two things count as looking away: a prediction outside the viewport, and no
 * prediction at all (face lost — the user turned away or left). Both are
 * debounced hard by `GAZE_RULES`, because a raw WebGazer stream is far too
 * noisy to act on directly and a false accusation of distraction is the worst
 * outcome this feature can produce.
 *
 * Until the tracker has been calibrated its coordinates aren't trustworthy, so
 * `calibration` downgrades the check to face presence alone — a signal that
 * needs no training at all.
 *
 * Like location, this is strictly optional: every failure path resolves to "not
 * tracking", which the session then treats exactly as if the feature were off.
 */
export function useFocusTracking(enabled: boolean, calibration: GazeCalibration): GazeState {
  const [state, setState] = useState<GazeState>(IDLE);

  /**
   * Raw sample bookkeeping. Predictions arrive ~20×/second, so none of this can
   * live in state — the machine runs on refs and only publishes on transitions.
   */
  const sample = useRef({ at: 0, onScreen: false, point: null as GazePrediction | null });
  /** Debounce state: the current raw signal and when it last flipped. */
  const signal = useRef<{ onScreen: boolean; since: number }>({ onScreen: true, since: 0 });
  const wandering = useRef(false);
  const episodes = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    // Support and start-up are the two branches that must set state
    // synchronously: neither can be detected during render without breaking SSR.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ ...IDLE, status: "unsupported" });
      return;
    }

    const at = Date.now();
    sample.current = { at, onScreen: true, point: null };
    signal.current = { onScreen: true, since: at };
    wandering.current = false;
    episodes.current = 0;
    setState({ ...IDLE, status: "loading" });
    /* eslint-enable react-hooks/set-state-in-effect */

    let cancelled = false;
    let started: WebGazer | null = null;

    void (async () => {
      try {
        const webgazer = await loadWebGazer();
        if (cancelled) return;

        webgazer
          .setRegression("weightedRidge")
          .setTracker("clmtrackr")
          .applyKalmanFilter(true)
          // Calibration clicks are worth keeping between sessions; re-doing the
          // dots every time would be its own kind of distraction.
          .saveDataAcrossSessions(true)
          .setGazeListener((data) => {
            const nextPoint = smoothPoint(data, sample.current.point);
            sample.current = {
              at: Date.now(),
              onScreen: isOnScreen(nextPoint, window.innerWidth, window.innerHeight),
              point: nextPoint,
            };
          });

        await webgazer.begin();
        if (cancelled) {
          shutdown(webgazer);
          return;
        }

        // The floating preview and gaze dot are WebGazer's debug UI; the panel
        // renders its own status instead.
        webgazer.showVideoPreview(false).showPredictionPoints(false);
        started = webgazer;
        setState((prev) => ({ ...prev, status: "tracking" }));
      } catch (err) {
        if (cancelled) return;
        console.warn("[incline] eye tracking could not start", err);
        setState({ ...IDLE, status: isPermissionError(err) ? "denied" : "error" });
      }
    })();

    return () => {
      cancelled = true;
      if (started) shutdown(started);
    };
  }, [enabled]);

  // --- The state machine ----------------------------------------------------
  // Evaluated on a slow tick rather than per sample, so a jittery prediction
  // stream can't cause a render storm.
  //
  // Gated on `tracking`: a camera that never started produces no samples, which
  // is indistinguishable from a stale feed. Without this gate a blocked or
  // broken camera would quietly log distractions against a user who was sitting
  // there working the whole time.
  const running = state.status === "tracking";
  useEffect(() => {
    if (!enabled || !running) return;

    const id = window.setInterval(() => {
      const now = Date.now();

      // A hidden tab throttles WebGazer's loop, so its samples go stale for
      // reasons that have nothing to do with the user's eyes. Visibility is
      // already tracked as its own distraction signal — freeze here instead of
      // double-counting, and restart the debounce when the tab comes back.
      if (document.hidden) {
        signal.current = { onScreen: true, since: now };
        return;
      }

      const fresh = now - sample.current.at <= GAZE_RULES.staleAfterMs;
      // Uncalibrated, "is there a face pointed at the screen" is all we can
      // honestly claim to know.
      const onScreen =
        fresh &&
        (calibration === "done" ? sample.current.onScreen : sample.current.point !== null);
      if (onScreen !== signal.current.onScreen) {
        signal.current = { onScreen, since: now };
      }

      const held = now - signal.current.since;
      let next = wandering.current;
      if (!wandering.current && !onScreen && held >= GAZE_RULES.wanderAfterMs) {
        next = true;
        episodes.current += 1;
        playWanderChime();
      } else if (wandering.current && onScreen && held >= GAZE_RULES.settleMs) {
        next = false;
      }
      wandering.current = next;

      setState((prev) => {
        const nextPoint = sample.current.point;
        const pointChanged =
          prev.point === null
            ? nextPoint !== null
            : nextPoint === null
              ? true
              : prev.point.x !== nextPoint.x || prev.point.y !== nextPoint.y;

        if (prev.wandering === next && prev.episodes === episodes.current && !pointChanged) {
          return prev;
        }

        return {
          ...prev,
          wandering: next,
          episodes: episodes.current,
          point: nextPoint,
        };
      });
    }, GAZE_RULES.tickMs);

    return () => {
      window.clearInterval(id);
      // Nothing is evaluating the signal any more, so a warning left on screen
      // would never clear itself.
      wandering.current = false;
      signal.current = { onScreen: true, since: Date.now() };
      setState((prev) => (prev.wandering ? { ...prev, wandering: false } : prev));
    };
  }, [enabled, running, calibration]);

  // Derived rather than stored, so turning tracking off can never leave a stale
  // "wandering" flag applied to the next session.
  return enabled ? state : IDLE;
}
