"use client";

import { useEffect, useRef, useState } from "react";
import type { FaceTracker, GazePrediction, WebGazer } from "webgazer";

import {
  isFacingScreen,
  POSE_RULES,
  PoseBaseline,
  readHeadPose,
} from "@/lib/facePose";
import {
  AttentionWindow,
  GAZE_RULES,
  isOnScreen,
  playWanderChime,
  GazeSmoother,
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

/** Why the user currently doesn't look present, if they don't. */
export type GazeAwayReason =
  /** No face in frame at all. */
  | "absent"
  /** Face there, head pointed somewhere other than the screen. */
  | "turned"
  /** Face there and pointed at the screen, but the eyes are shut. */
  | "eyes-closed"
  /** Everything points at the screen, but the calibrated gaze doesn't land on it. */
  | "off-screen";

export interface GazeState {
  status: GazeStatus;
  /** True once eyes have been off-screen long enough to count as distraction. */
  wandering: boolean;
  /** Wander episodes so far in this tracking run. */
  episodes: number;
  /** Latest prediction, viewport pixels. Null while the face is lost. */
  point: GazePrediction | null;
  /**
   * The live, undebounced reason the user reads as away — null when they read as
   * present. Distinct from `wandering`, which only flips once a reason has held
   * long enough to be worth acting on. Good for an ambient hint, not a verdict.
   */
  reason: GazeAwayReason | null;
}

const IDLE: GazeState = {
  status: "off",
  wandering: false,
  episodes: 0,
  point: null,
  reason: null,
};

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
/** The live instance, for the calibration overlay to train against. */
let instance: WebGazer | null = null;

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

/**
 * Trains the model on a known screen position.
 *
 * The calibration overlay uses this instead of relying on WebGazer's own click
 * listener, because a click lands wherever the pointer happened to be inside the
 * 44px target while the eyes were on its centre. Feeding the centre directly
 * removes that error from every single training sample.
 */
export function recordCalibrationPoint(x: number, y: number): void {
  try {
    instance?.recordScreenPosition(x, y, "click");
  } catch {
    // Not started yet, or torn down mid-click. Nothing to train.
  }
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
  if (instance === webgazer) instance = null;
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
   *
   * `at` and `faceAt` are deliberately separate. `at` is the last time WebGazer
   * ran at all (null frames included) and detects a stalled feed; `faceAt` is
   * the last time it actually found a face. Collapsing the two — as in, bumping
   * the timestamp on a null frame and carrying the previous point forward — is
   * exactly how "the user walked away" becomes undetectable.
   */
  const sample = useRef({
    at: 0,
    faceAt: 0,
    /** Identity of the last mesh frame, used to tell a new detection from a stale one. */
    positions: null as number[][] | null,
    /** Head oriented at the screen — the primary, calibration-free verdict. */
    facing: true,
    /** Gaze prediction inside the viewport — only consulted once calibrated. */
    gazeOnScreen: true,
    /** When the eyes last closed and stayed closed, or 0 if they're open. */
    eyesClosedSince: 0,
    point: null as GazePrediction | null,
  });
  const baseline = useRef(new PoseBaseline());
  const attention = useRef(new AttentionWindow());
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
    sample.current = {
      at,
      faceAt: at,
      positions: null,
      facing: true,
      gazeOnScreen: true,
      eyesClosedSince: 0,
      point: null,
    };
    baseline.current.reset();
    attention.current.reset(at, true);
    wandering.current = false;
    episodes.current = 0;
    setState({ ...IDLE, status: "loading" });
    /* eslint-enable react-hooks/set-state-in-effect */

    let cancelled = false;
    let started: WebGazer | null = null;
    const smoother = new GazeSmoother();

    void (async () => {
      try {
        const webgazer = await loadWebGazer();
        if (cancelled) return;

        // The face-mesh tracker is the only one WebGazer 3.x ships; naming any
        // other (the docs still mention clmtrackr) silently leaves the default
        // in place after logging a warning.
        webgazer.setTracker("TFFacemesh");
        // Held for the listener: this is the mesh we read head pose off, and
        // `setTracker` replaces the instance, so it has to be grabbed after.
        const tracker: FaceTracker | null = webgazer.getTracker() ?? null;

        webgazer
          .setRegression("weightedRidge")
          .applyKalmanFilter(true)
          // Calibration clicks are worth keeping between sessions; re-doing the
          // dots every time would be its own kind of distraction.
          .saveDataAcrossSessions(true)
          .setGazeListener((data) => {
            const now = Date.now();
            const prev = sample.current;

            // Face presence is read from the mesh, not from `data`. The
            // regression returns null both when no face was found *and* when it
            // has no click data to interpolate from, so on an uncalibrated
            // session it is null on every single frame — a user sitting
            // perfectly still would look like an empty chair. The tracker only
            // reassigns its landmark array on a successful detection, so a
            // changed reference is an unambiguous "a face was seen this frame".
            const positions = tracker?.getPositions() ?? null;
            const faceSeen = positions !== null && positions !== prev.positions;

            if (!faceSeen) {
              // Feed is alive, face isn't there. `faceAt` deliberately stays put
              // — the state machine decides whether this is a blink or absence.
              sample.current = { ...prev, at: now };
              return;
            }

            // A blink-length gap is noise; anything longer means the face went
            // away and came back, and neither the smoothed gaze track nor the
            // eye-closure timer still describes what's in front of the camera.
            const returning = now - prev.faceAt > GAZE_RULES.faceLostAfterMs;
            if (returning) smoother.reset();

            const pose = readHeadPose(positions);
            const eyesOpen = !pose || pose.eyeOpenness >= POSE_RULES.eyesClosedRatio;
            const eyesClosedSince = eyesOpen || returning ? 0 : prev.eyesClosedSince || now;

            // Head orientation is the primary verdict; it needs no calibration
            // and holds steady where the regression jitters.
            const facing = pose ? isFacingScreen(pose, baseline.current) : true;

            // Gaze coordinates only ever tighten that verdict, and only once
            // they've been trained — an uncalibrated prediction is not evidence.
            const point = data ? (smoother.update(data.x, data.y) ?? prev.point) : prev.point;
            const gazeOnScreen =
              !data || isOnScreen(point, window.innerWidth, window.innerHeight);

            sample.current = {
              at: now,
              faceAt: now,
              positions,
              facing,
              gazeOnScreen,
              eyesClosedSince,
              point,
            };

            // Learned only from frames we already believe are attentive, so the
            // neutral can't drift towards a pose the user held while distracted.
            if (pose) baseline.current.observe(pose, facing && eyesOpen);
          });

        await webgazer.begin();
        if (cancelled) {
          shutdown(webgazer);
          return;
        }

        // WebGazer trains itself on every mousemove, treating the cursor as
        // ground truth for where the user is looking. In a study timer the
        // cursor sits parked for minutes at a time, so that pumps thousands of
        // "the user is staring at this idle pointer" samples into the regression
        // and pulls every prediction towards it. There's no switch for the move
        // listener alone, but its rate limiter takes a period — so an
        // effectively infinite one retires it while leaving click training
        // (which is real calibration data, and what persists across sessions)
        // untouched.
        webgazer.params.moveTickSize = Number.MAX_SAFE_INTEGER;

        // The floating preview and gaze dot are WebGazer's debug UI; the panel
        // renders its own status instead.
        webgazer.showVideoPreview(false).showPredictionPoints(false);
        started = webgazer;
        instance = webgazer;
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

    // Captured once: the window instance outlives every tick, and reading the
    // ref inside the cleanup would be reading it after the effect has moved on.
    const attentionWindow = attention.current;

    const id = window.setInterval(() => {
      const now = Date.now();

      // A hidden tab throttles WebGazer's loop, so its samples go stale for
      // reasons that have nothing to do with the user's eyes. Visibility is
      // already tracked as its own distraction signal — freeze here instead of
      // double-counting, and restart the debounce when the tab comes back.
      if (document.hidden) {
        attentionWindow.reset(now, true);
        sample.current = { ...sample.current, at: now, faceAt: now, eyesClosedSince: 0 };
        return;
      }

      const current = sample.current;
      const feedAlive = now - current.at <= GAZE_RULES.staleAfterMs;
      const faceVisible = now - current.faceAt <= GAZE_RULES.faceLostAfterMs;
      const eyesShut =
        current.eyesClosedSince > 0 &&
        now - current.eyesClosedSince >= POSE_RULES.eyesClosedAfterMs;

      // A stalled feed tells us nothing about the user, so hold the window
      // steady rather than accusing them on the strength of a hung camera.
      if (!feedAlive) {
        attentionWindow.reset(now, attentionWindow.onScreen);
      } else {
        // The verdict, in order of how much we trust each signal:
        //
        //  1. A face has to be there at all — nothing else means anything if the
        //     camera can't see the user.
        //  2. The head has to be pointed at the screen. This is the workhorse:
        //     it comes off the mesh geometry, needs no calibration, and doesn't
        //     wobble the way a regressed pixel does.
        //  3. The eyes have to be open. Blinks are already filtered out, so this
        //     only catches eyes genuinely shut — dozing, or a long rub of the face.
        //  4. Only *then*, and only if the dots were actually done, does the gaze
        //     coordinate get a vote. It can catch eyes flicking to a second
        //     monitor while the head stays put, which pose alone never will —
        //     but it is a refinement on top of a sound answer, never the answer.
        const attentive =
          faceVisible &&
          current.facing &&
          !eyesShut &&
          (calibration === "done" ? current.gazeOnScreen : true);
        attentionWindow.push(now, attentive);
      }

      const offMs = attentionWindow.offMs(now);
      const steadyMs = attentionWindow.steadyMs(now);
      const onScreenNow = attentionWindow.onScreen;

      let next = wandering.current;
      if (!wandering.current && offMs >= GAZE_RULES.wanderBudgetMs) {
        next = true;
        episodes.current += 1;
        playWanderChime();
      } else if (wandering.current && onScreenNow && steadyMs >= GAZE_RULES.settleMs) {
        next = false;
        // Spend the budget so the very next tick can't immediately re-fire on
        // the off-screen time that triggered the episode we just cleared.
        attentionWindow.reset(now, true);
      }
      wandering.current = next;

      // Most specific cause first, so the UI can say something truer than
      // "you look distracted".
      const reason: GazeAwayReason | null = !feedAlive
        ? null
        : !faceVisible
          ? "absent"
          : eyesShut
            ? "eyes-closed"
            : !current.facing
              ? "turned"
              : !current.gazeOnScreen && calibration === "done"
                ? "off-screen"
                : null;

      setState((prev) => {
        const nextPoint = faceVisible ? current.point : null;
        const pointChanged =
          prev.point === null
            ? nextPoint !== null
            : nextPoint === null
              ? true
              : prev.point.x !== nextPoint.x || prev.point.y !== nextPoint.y;

        if (
          prev.wandering === next &&
          prev.episodes === episodes.current &&
          prev.reason === reason &&
          !pointChanged
        ) {
          return prev;
        }

        return { ...prev, wandering: next, episodes: episodes.current, point: nextPoint, reason };
      });
    }, GAZE_RULES.tickMs);

    return () => {
      window.clearInterval(id);
      // Nothing is evaluating the signal any more, so a warning left on screen
      // would never clear itself.
      wandering.current = false;
      attentionWindow.reset(Date.now(), true);
      setState((prev) => (prev.wandering ? { ...prev, wandering: false } : prev));
    };
  }, [enabled, running, calibration]);

  // Derived rather than stored, so turning tracking off can never leave a stale
  // "wandering" flag applied to the next session.
  return enabled ? state : IDLE;
}
