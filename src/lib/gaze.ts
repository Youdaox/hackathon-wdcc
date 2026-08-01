/**
 * Gaze-tracking rules and pure helpers.
 *
 * WebGazer gives us a noisy point roughly 20×/second plus a null whenever it
 * loses the face. None of that is trustworthy sample-by-sample, so every
 * threshold that turns raw predictions into "the user wandered off" lives here,
 * in one tunable place — the same way `RULES` holds the growth balance.
 */
/**
 * How much the tracker has been taught.
 *
 * - `none` — never asked; show the dots.
 * - `skipped` — user declined the dots. Predictions are too rough to judge
 *   *where* on screen they're looking, so only face presence counts.
 * - `done`   — trained; off-screen gaze counts too.
 */
export type GazeCalibration = "none" | "skipped" | "done";

export const GAZE_RULES = {
  /** Predictions this far outside the viewport still count as on-screen. */
  marginPx: 140,
  /** Low-pass smoothing for jittery gaze samples. */
  smoothingAlpha: 0.35,
  /** Ignore jumps larger than this before smoothing; they usually come from noisy frames. */
  maxJumpPx: 320,
  /** Off-screen (or no face) must hold this long before we warn. */
  wanderAfterMs: 4_000,
  /** …and eyes must be back this long before we clear the warning. */
  settleMs: 1_000,
  /** No prediction for this long means the feed stalled — treat as looking away. */
  staleAfterMs: 2_000,
  /** How often the state machine is evaluated. */
  tickMs: 250,
  /** Calibration points, as fractions of the viewport. */
  calibrationPoints: [
    [0.5, 0.5],
    [0.1, 0.1],
    [0.9, 0.1],
    [0.1, 0.9],
    [0.9, 0.9],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Clicks per calibration point — WebGazer trains on each one. */
  clicksPerPoint: 3,
} as const;

/**
 * Is this prediction plausibly on the screen?
 *
 * The margin is generous on purpose: an uncalibrated WebGazer drifts by a
 * hundred-odd pixels, and false "you're distracted" warnings are far more
 * damaging to trust than missing a brief glance away.
 */
export function isOnScreen(
  point: { x: number; y: number } | null,
  width: number,
  height: number,
): boolean {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const m = GAZE_RULES.marginPx;
  return point.x >= -m && point.x <= width + m && point.y >= -m && point.y <= height + m;
}

/**
 * Smooth a raw WebGazer prediction so the overlay does not jump on every noisy frame.
 */
export function smoothPoint(
  point: { x: number; y: number } | null,
  previous: { x: number; y: number } | null,
): { x: number; y: number } | null {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return previous;
  if (!previous) return point;

  const dx = point.x - previous.x;
  const dy = point.y - previous.y;
  const jump = Math.hypot(dx, dy);
  if (jump > GAZE_RULES.maxJumpPx) return previous;

  return {
    x: previous.x + GAZE_RULES.smoothingAlpha * dx,
    y: previous.y + GAZE_RULES.smoothingAlpha * dy,
  };
}

/**
 * Two short tones, played when a wander is first detected.
 *
 * Built on a throwaway AudioContext so there's nothing to keep alive between
 * warnings, and every failure (no WebAudio, autoplay blocked) is swallowed —
 * the visual warning is the real signal, this is just the nudge.
 */
export function playWanderChime(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;

    for (const [index, freq] of [880, 660].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = now + index * 0.16;
      osc.type = "sine";
      osc.frequency.value = freq;
      // Ramped rather than switched, so it reads as a chime and not a click.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.09, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.16);
    }

    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    // Audio is a nicety; never let it break a session.
  }
}
