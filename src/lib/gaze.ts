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
  /**
   * How far outside the viewport a prediction may land and still count as
   * on-screen, as a fraction of the smaller viewport dimension, clamped to the
   * bounds below.
   *
   * Fraction rather than a flat pixel count because WebGazer's error scales
   * with the screen it was calibrated on: 140px is a third of a phone's width
   * and a rounding error on a 27" monitor. The old flat margin meant a laptop
   * user could look at the phone beside the keyboard and still read as "on
   * screen".
   */
  marginFraction: 0.1,
  minMarginPx: 48,
  maxMarginPx: 150,

  /** Low-pass smoothing for jittery gaze samples. Higher = more responsive. */
  smoothingAlpha: 0.45,
  /** Samples fed to the median pre-filter that removes one-frame spikes. */
  medianWindow: 5,
  /** Jumps larger than this are treated as noise and dropped before smoothing. */
  maxJumpPx: 400,
  /**
   * …but only this many in a row. A genuine fast saccade across a wide screen
   * looks exactly like noise, so an unbroken run of "impossible" jumps is taken
   * at face value and the filter re-seeds there.
   */
  maxConsecutiveJumps: 3,

  /**
   * Null frames shorter than this are blinks, not absence. WebGazer drops the
   * face for a frame or two constantly; counting those as "looked away" is what
   * makes naive implementations fire nonstop.
   */
  faceLostAfterMs: 500,

  /**
   * Sliding window the attention ratio is measured over, and how much off-screen
   * time inside it triggers a warning.
   *
   * Measured as a budget over a window rather than one uninterrupted stretch:
   * real distraction is a phone glanced at six times in ten seconds, which a
   * continuous-hold rule never catches because the gaze keeps flicking back.
   */
  windowMs: 8_000,
  wanderBudgetMs: 3_000,
  /** Eyes must be back, uninterrupted, this long before the warning clears. */
  settleMs: 1_500,

  /** No prediction at all for this long means the feed stalled, not the user. */
  staleAfterMs: 2_000,
  /** How often the state machine is evaluated. */
  tickMs: 200,

  /**
   * Calibration points, as fractions of the viewport.
   *
   * A 3×3 grid: the ridge regression maps eye features to screen position
   * linearly, so it can only interpolate across the region it has seen. The old
   * five-point cross left the edge midpoints untrained, which is exactly where
   * "is this still on screen?" gets decided.
   */
  calibrationPoints: [
    [0.5, 0.5],
    [0.08, 0.08],
    [0.5, 0.08],
    [0.92, 0.08],
    [0.08, 0.5],
    [0.92, 0.5],
    [0.08, 0.92],
    [0.5, 0.92],
    [0.92, 0.92],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Clicks per calibration point — WebGazer trains on each one. */
  clicksPerPoint: 3,
} as const;

/** The on-screen margin for a given viewport, in pixels. */
export function screenMargin(width: number, height: number): number {
  const base = Math.min(width, height) * GAZE_RULES.marginFraction;
  return Math.min(GAZE_RULES.maxMarginPx, Math.max(GAZE_RULES.minMarginPx, base));
}

/**
 * Is this prediction plausibly on the screen?
 *
 * Deliberately forgiving: WebGazer drifts, and a false "you're distracted" is
 * far more damaging to trust than a missed glance. The margin is what buys that
 * forgiveness — the debounce in the hook buys the rest.
 */
export function isOnScreen(
  point: { x: number; y: number } | null,
  width: number,
  height: number,
): boolean {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const m = screenMargin(width, height);
  return point.x >= -m && point.x <= width + m && point.y >= -m && point.y <= height + m;
}

/**
 * Robust smoother for the raw prediction stream: a median pre-filter, then an
 * exponential moving average.
 *
 * The median is the important half. WebGazer's per-frame error is not Gaussian
 * — it throws occasional wild single-frame outliers, and an EMA on its own
 * drags those into the smoothed track, which reads downstream as a gaze that
 * shot off screen and came back. The median discards them outright; the EMA
 * then just takes the edge off the remaining jitter.
 */
export class GazeSmoother {
  private recentX: number[] = [];
  private recentY: number[] = [];
  private smoothedX: number | null = null;
  private smoothedY: number | null = null;
  private rejected = 0;

  constructor(
    private readonly alpha = GAZE_RULES.smoothingAlpha,
    private readonly windowSize = GAZE_RULES.medianWindow,
  ) {}

  /** Drops all history. Call when the face is reacquired — the old track is stale. */
  reset(): void {
    this.recentX = [];
    this.recentY = [];
    this.smoothedX = null;
    this.smoothedY = null;
    this.rejected = 0;
  }

  update(x: number, y: number): { x: number; y: number } | null {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return this.current();

    // Gate implausible jumps against the *smoothed* track, not the last raw
    // sample, so a single outlier can't drag the gate along with it.
    if (this.smoothedX !== null && this.smoothedY !== null) {
      const dx = x - this.smoothedX;
      const dy = y - this.smoothedY;
      if (Math.hypot(dx, dy) > GAZE_RULES.maxJumpPx) {
        this.rejected += 1;
        if (this.rejected <= GAZE_RULES.maxConsecutiveJumps) return this.current();
        // Sustained — the eyes really did move that far. Start fresh there.
        this.reset();
      }
    }
    this.rejected = 0;

    push(this.recentX, x, this.windowSize);
    push(this.recentY, y, this.windowSize);
    const mx = median(this.recentX);
    const my = median(this.recentY);

    if (this.smoothedX === null || this.smoothedY === null) {
      this.smoothedX = mx;
      this.smoothedY = my;
    } else {
      this.smoothedX = this.alpha * mx + (1 - this.alpha) * this.smoothedX;
      this.smoothedY = this.alpha * my + (1 - this.alpha) * this.smoothedY;
    }
    return { x: this.smoothedX, y: this.smoothedY };
  }

  current(): { x: number; y: number } | null {
    return this.smoothedX === null || this.smoothedY === null
      ? null
      : { x: this.smoothedX, y: this.smoothedY };
  }
}

function push(buffer: number[], value: number, limit: number): void {
  buffer.push(value);
  if (buffer.length > limit) buffer.shift();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Time spent looking away, integrated over a sliding window.
 *
 * Stores transitions rather than samples, so the memory is bounded by how often
 * attention actually flips, not by the sample rate. `offMs` answers "how much of
 * the last N seconds was spent off-screen" — the question a wander actually is —
 * while `steadyMs` answers "how long has the current state held", which is what
 * clears the warning.
 */
export class AttentionWindow {
  /** Transitions, oldest first. Each entry starts a run of `onScreen`. */
  private runs: Array<{ at: number; onScreen: boolean }> = [];

  constructor(private readonly windowMs = GAZE_RULES.windowMs) {}

  reset(now: number, onScreen = true): void {
    this.runs = [{ at: now, onScreen }];
  }

  push(now: number, onScreen: boolean): void {
    const last = this.runs.at(-1);
    if (!last) {
      this.runs = [{ at: now, onScreen }];
      return;
    }
    if (last.onScreen !== onScreen) this.runs.push({ at: now, onScreen });
    this.prune(now);
  }

  /** Milliseconds spent off-screen within the trailing window. */
  offMs(now: number): number {
    const from = now - this.windowMs;
    let total = 0;
    for (const [index, run] of this.runs.entries()) {
      if (run.onScreen) continue;
      const start = Math.max(run.at, from);
      const end = this.runs[index + 1]?.at ?? now;
      if (end > start) total += end - start;
    }
    return total;
  }

  /** How long the current state has held, uninterrupted. */
  steadyMs(now: number): number {
    const last = this.runs.at(-1);
    return last ? now - last.at : 0;
  }

  get onScreen(): boolean {
    return this.runs.at(-1)?.onScreen ?? true;
  }

  /**
   * Drops runs that ended before the window opened, keeping the one straddling
   * the boundary so the integral over a partially-elapsed run stays correct.
   */
  private prune(now: number): void {
    const from = now - this.windowMs;
    let keepFrom = 0;
    for (let i = 0; i < this.runs.length - 1; i += 1) {
      if (this.runs[i + 1].at <= from) keepFrom = i + 1;
      else break;
    }
    if (keepFrom > 0) this.runs = this.runs.slice(keepFrom);
  }
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
