/**
 * Head pose and eye openness, read straight off the face mesh.
 *
 * The gaze regression is the least reliable thing WebGazer does: it maps eye
 * patches to a screen pixel through a ridge fit over a handful of click
 * samples, and the result wobbles by a hundred-odd pixels even when it's
 * behaving. But answering "is this person still facing their screen" doesn't
 * need a pixel — it needs the orientation of the head, which the underlying
 * MediaPipe mesh gives us directly and far more steadily. So we ask the mesh
 * that question and leave the regression to refine the answer only once it has
 * actually been calibrated.
 *
 * Everything here is scale-invariant — measured as ratios of the face's own
 * width and height — so it doesn't care how close the user sits or what
 * resolution the webcam runs at.
 */

/**
 * Indices into MediaPipe's 468-point face mesh.
 * Left/right are from the subject's perspective, matching WebGazer's own usage.
 */
export const FACE_LANDMARKS = {
  noseTip: 1,
  chin: 152,
  faceLeft: 234,
  faceRight: 454,
  leftEyeOuter: 263,
  leftEyeInner: 362,
  leftEyeUpper: 386,
  leftEyeLower: 374,
  rightEyeOuter: 33,
  rightEyeInner: 133,
  rightEyeUpper: 159,
  rightEyeLower: 145,
} as const;

export const POSE_RULES = {
  /**
   * How far the head may turn or tilt from its neutral pose before we stop
   * calling it "facing the screen", as a fraction of face width / height.
   *
   * Yaw is the looser of the two: people scan a wide monitor by turning their
   * head a little. This one trips around 22° off neutral — past where any part
   * of a laptop screen still is.
   */
  yawLimit: 0.26,
  /**
   * Pitch is tighter (~20°) because the thing we most want to catch — glancing
   * down at a phone in your lap — is almost pure pitch.
   */
  pitchLimit: 0.17,
  /** Head tilted this far past neutral reads as slumped, not studying. */
  rollLimit: 0.7,

  /** Below this eye-aspect-ratio the eyes are shut rather than narrowed. */
  eyesClosedRatio: 0.15,
  /** …and they must stay shut this long to be more than a blink. */
  eyesClosedAfterMs: 900,

  /** Pose samples collected before a neutral is committed (~2s at 20Hz). */
  baselineSamples: 40,
  /**
   * How fast the neutral follows the user afterwards. Deliberately glacial:
   * it should absorb someone slowly settling into their chair over minutes,
   * never a deliberate turn away over seconds.
   */
  baselineAlpha: 0.002,
} as const;

/** A single mesh landmark: `[x, y, z]` in video pixels. */
type Landmark = readonly number[];

export interface HeadPose {
  /** Nose offset from the face's horizontal centre, in face widths. */
  yaw: number;
  /** Nose height relative to the eye line, in face heights. */
  pitch: number;
  /** Head tilt in radians, from the eye-corner line. */
  roll: number;
  /** Mean eye aspect ratio. ~0.3 wide open, ~0.1 shut. */
  eyeOpenness: number;
}

/**
 * Derives head pose from a mesh frame, or null if the frame is unusable.
 *
 * Roll is measured first and the face is rotated flat before yaw and pitch are
 * read, because otherwise a tilted head leaks into both of them — lean your
 * head on your hand and an uncorrected pitch reading drifts far enough to look
 * like you're staring at your lap.
 */
export function readHeadPose(positions: Landmark[] | null | undefined): HeadPose | null {
  if (!positions || positions.length <= FACE_LANDMARKS.faceRight) return null;

  const at = (index: number) => {
    const point = positions[index];
    return point && Number.isFinite(point[0]) && Number.isFinite(point[1])
      ? { x: point[0], y: point[1] }
      : null;
  };

  const nose = at(FACE_LANDMARKS.noseTip);
  const chin = at(FACE_LANDMARKS.chin);
  const left = at(FACE_LANDMARKS.faceLeft);
  const right = at(FACE_LANDMARKS.faceRight);
  const eyeL = at(FACE_LANDMARKS.leftEyeOuter);
  const eyeR = at(FACE_LANDMARKS.rightEyeOuter);
  if (!nose || !chin || !left || !right || !eyeL || !eyeR) return null;

  // The eye line is an orientation, not a direction: which outer corner sits on
  // which side of the image depends on how the camera is mounted and whether
  // the feed is mirrored, and reading it the "wrong" way round yields π rather
  // than 0 for a perfectly level head — which then de-rotates the face upside
  // down and inverts yaw and pitch with it. Folding the angle into a quarter
  // turn either way removes the ambiguity along with the dependency.
  const roll = foldAngle(Math.atan2(eyeL.y - eyeR.y, eyeL.x - eyeR.x));
  // Rotating by -roll about the nose puts the face upright in a frame where a
  // vertical offset means pitch and a horizontal one means yaw, and nothing else.
  const cos = Math.cos(-roll);
  const sin = Math.sin(-roll);
  const flatten = (p: { x: number; y: number }) => {
    const dx = p.x - nose.x;
    const dy = p.y - nose.y;
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  };

  const fLeft = flatten(left);
  const fRight = flatten(right);
  const fChin = flatten(chin);
  const fEyeL = flatten(eyeL);
  const fEyeR = flatten(eyeR);

  const faceWidth = Math.abs(fRight.x - fLeft.x);
  const eyeMidY = (fEyeL.y + fEyeR.y) / 2;
  const faceHeight = Math.abs(fChin.y - eyeMidY);
  if (faceWidth < 1 || faceHeight < 1) return null;

  // The nose sits at the origin, so the face-edge midpoint *is* the yaw offset.
  const yaw = -(fLeft.x + fRight.x) / 2 / faceWidth;
  const pitch = -eyeMidY / faceHeight;

  return { yaw, pitch, roll, eyeOpenness: eyeAspectRatio(positions) };
}

/**
 * Mean eye aspect ratio: lid separation over eye width.
 *
 * Normalised by the eye's own width so it survives the user leaning in and out,
 * which a raw pixel height does not.
 */
export function eyeAspectRatio(positions: Landmark[]): number {
  const ratios = [
    aspect(positions, "left"),
    aspect(positions, "right"),
  ].filter((value): value is number => value !== null);
  if (ratios.length === 0) return 1;
  return ratios.reduce((a, b) => a + b, 0) / ratios.length;
}

function aspect(positions: Landmark[], side: "left" | "right"): number | null {
  const keys =
    side === "left"
      ? (["leftEyeUpper", "leftEyeLower", "leftEyeOuter", "leftEyeInner"] as const)
      : (["rightEyeUpper", "rightEyeLower", "rightEyeOuter", "rightEyeInner"] as const);
  const [upper, lower, outer, inner] = keys.map((key) => positions[FACE_LANDMARKS[key]]);
  if (!upper || !lower || !outer || !inner) return null;

  const width = Math.hypot(outer[0] - inner[0], outer[1] - inner[1]);
  if (width < 1) return null;
  return Math.hypot(upper[0] - lower[0], upper[1] - lower[1]) / width;
}

/**
 * The user's own neutral head pose.
 *
 * Absolute pose thresholds are meaningless: a webcam sitting below a raised
 * monitor means the user's honest, attentive head pose is already pitched well
 * off zero, and every face is built differently besides. So "facing the screen"
 * is defined as *near where this person's head normally is*, learned in the
 * first couple of seconds and thereafter nudged only while they're judged
 * attentive — a baseline that kept adapting while someone stared out of the
 * window would quietly redefine looking away as normal.
 */
export class PoseBaseline {
  private warmupYaw: number[] = [];
  private warmupPitch: number[] = [];
  private warmupRoll: number[] = [];
  private neutral: { yaw: number; pitch: number; roll: number } | null = null;

  reset(): void {
    this.warmupYaw = [];
    this.warmupPitch = [];
    this.warmupRoll = [];
    this.neutral = null;
  }

  /** True once enough samples have been seen to judge anything. */
  get ready(): boolean {
    return this.neutral !== null;
  }

  observe(pose: HeadPose, attentive: boolean): void {
    if (!this.neutral) {
      this.warmupYaw.push(pose.yaw);
      this.warmupPitch.push(pose.pitch);
      this.warmupRoll.push(pose.roll);
      if (this.warmupYaw.length >= POSE_RULES.baselineSamples) {
        // Median, not mean: the warm-up window is short enough that one glance
        // away during it would drag an average badly off.
        this.neutral = {
          yaw: median(this.warmupYaw),
          pitch: median(this.warmupPitch),
          roll: median(this.warmupRoll),
        };
      }
      return;
    }

    if (!attentive) return;
    const a = POSE_RULES.baselineAlpha;
    this.neutral = {
      yaw: this.neutral.yaw * (1 - a) + pose.yaw * a,
      pitch: this.neutral.pitch * (1 - a) + pose.pitch * a,
      roll: this.neutral.roll * (1 - a) + pose.roll * a,
    };
  }

  /** Signed distance of a pose from neutral, or null while still learning. */
  deviation(pose: HeadPose): { yaw: number; pitch: number; roll: number } | null {
    if (!this.neutral) return null;
    return {
      yaw: pose.yaw - this.neutral.yaw,
      pitch: pose.pitch - this.neutral.pitch,
      roll: pose.roll - this.neutral.roll,
    };
  }
}

/**
 * Is the head oriented at the screen?
 *
 * Returns true while the baseline is still warming up: an unproven baseline is
 * no grounds for accusing anyone.
 */
export function isFacingScreen(pose: HeadPose, baseline: PoseBaseline): boolean {
  const off = baseline.deviation(pose);
  if (!off) return true;
  return (
    Math.abs(off.yaw) <= POSE_RULES.yawLimit &&
    Math.abs(off.pitch) <= POSE_RULES.pitchLimit &&
    Math.abs(off.roll) <= POSE_RULES.rollLimit
  );
}

/** Folds an angle into (-π/2, π/2] — the range a head tilt actually occupies. */
function foldAngle(radians: number): number {
  let a = radians;
  while (a > Math.PI / 2) a -= Math.PI;
  while (a <= -Math.PI / 2) a += Math.PI;
  return a;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
