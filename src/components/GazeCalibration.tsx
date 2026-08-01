"use client";

import { useMemo, useState } from "react";
import { recordCalibrationPoint } from "@/hooks/useFocusTracking";
import { GAZE_RULES } from "@/lib/gaze";
import { useIncline } from "@/lib/store";

const { calibrationPoints, clicksPerPoint } = GAZE_RULES;
const TOTAL_CLICKS = calibrationPoints.length * clicksPerPoint;

/**
 * One-time calibration for the eye tracker.
 *
 * WebGazer trains by pairing the eye features of the moment with a screen
 * coordinate, so every click here is one training sample. The coordinate we
 * hand it is the dot's *centre*, not the click position: the eyes are on the
 * centre, while the pointer lands anywhere inside a 44px target, and that gap
 * is pure labelling error in every sample it would otherwise learn from.
 */
export function GazeCalibrationOverlay() {
  const { gazeStatus, setGazeCalibration } = useIncline();
  const [clicks, setClicks] = useState<number[]>(() => calibrationPoints.map(() => 0));

  const done = useMemo(() => clicks.reduce((a, b) => a + b, 0), [clicks]);
  const ready = gazeStatus === "tracking";

  // Computed outside the updater rather than inside it: finishing calibration
  // is a side effect, and state updaters have to stay pure.
  const record = (index: number, element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    recordCalibrationPoint(box.left + box.width / 2, box.top + box.height / 2);

    const next = [...clicks];
    next[index] = Math.min(clicksPerPoint, next[index] + 1);
    setClicks(next);
    if (next.reduce((a, b) => a + b, 0) >= TOTAL_CLICKS) setGazeCalibration("done");
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface/95 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-x-0 top-16 flex flex-col items-center px-6 text-center">
        <div className="eyebrow">Calibrating eye tracking</div>
        <h2 className="mt-2 max-w-md text-2xl font-extrabold">
          {ready ? "Look at each dot and click it three times" : "Starting your camera…"}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted">
          {ready
            ? "Keep your eyes on the dot you're clicking. This teaches the tracker where you're looking — you only do it once."
            : "Allow camera access when your browser asks. Nothing is recorded or uploaded."}
        </p>
        <div className="tabular mt-4 text-sm font-semibold text-muted">
          {done} / {TOTAL_CLICKS}
        </div>
      </div>

      {ready &&
        calibrationPoints.map(([fx, fy], index) => {
          const hits = clicks[index];
          const complete = hits >= clicksPerPoint;
          return (
            <button
              key={`${fx}-${fy}`}
              type="button"
              aria-label={`Calibration point ${index + 1}, ${hits} of ${clicksPerPoint} clicks`}
              disabled={complete}
              onClick={(event) => record(index, event.currentTarget)}
              // Positioned as viewport fractions so the trained points span the
              // whole screen the user will actually be studying on.
              style={{ left: `${fx * 100}%`, top: `${fy * 100}%` }}
              className={`absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all ${
                complete
                  ? "border-moss bg-moss/30 opacity-40"
                  : "animate-pulse border-citrus bg-citrus/25 hover:scale-110"
              }`}
            >
              <span className="tabular text-xs font-bold">{complete ? "✓" : hits}</span>
            </button>
          );
        })}

      <button
        type="button"
        onClick={() => setGazeCalibration("skipped")}
        className="absolute inset-x-0 bottom-10 mx-auto block w-fit text-xs font-semibold text-faint transition-colors hover:text-muted"
      >
        Skip — track face presence only
      </button>
    </div>
  );
}
