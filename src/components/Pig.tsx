import type { CSSProperties } from "react";
import type { AvatarEmotion, Mood, PigAccessory, PigColor } from "@/lib/types";
import { PIG_PIXELS, PIXEL_CELL, PIXEL_COLS, PIXEL_ROWS } from "@/components/pigPixels";

/** Coat swatches — pastel only, gender-neutral, matches the app's pig palette. */
const COAT: Record<PigColor, { body: string; ear: string; nose: string; line: string }> = {
  pink: { body: "#FFC1CD", ear: "#FF97AC", nose: "#FFB9C4", line: "#6B3F35" },
  purple: { body: "#E6D9FA", ear: "#D5C0F3", nose: "#DCC7F5", line: "#5A4A63" },
  blue: { body: "#D7EAFB", ear: "#BEDCF4", nose: "#C7E2F7", line: "#3F5A66" },
};

const COAT_LABEL: Record<PigColor, string> = {
  pink: "Pink",
  purple: "Lavender",
  blue: "Sky",
};

export const PIG_COLORS: { value: PigColor; label: string; swatch: string }[] = (
  Object.keys(COAT) as PigColor[]
).map((value) => ({
  value,
  label: COAT_LABEL[value],
  swatch: COAT[value].body,
}));

const ACCESSORY_LABEL: Record<PigAccessory, string> = {
  none: "None",
  glasses: "Glasses",
  flower: "Flower",
};

export const PIG_ACCESSORIES: { value: PigAccessory; label: string }[] = (
  ["none", "glasses", "flower"] as PigAccessory[]
).map((value) => ({ value, label: ACCESSORY_LABEL[value] }));

export type PigStage = "baby" | "little" | "young" | "teen" | "master";

const STAGE_SCALE: Record<PigStage, number> = {
  baby: 0.6,
  little: 0.75,
  young: 0.9,
  teen: 1,
  master: 1.15,
};
export const STAGE_LABEL: Record<PigStage, string> = {
  baby: "Baby",
  little: "Little",
  young: "Young",
  teen: "Teen",
  master: "Master",
};

/** Five growth stages spread across the level range, mirroring the XP tiers (0/25/50/100/200). */
export function stageForLevel(level: number): PigStage {
  if (level >= 9) return "master";
  if (level >= 7) return "teen";
  if (level >= 5) return "young";
  if (level >= 3) return "little";
  return "baby";
}

/** The pig's posture — a simplified view of Mood (plus HP) matching the states it can act out. */
export type PigState = "healthy" | "hungry" | "sick" | "sleeping" | "fainted";

export function stateForMood(mood: Mood, hp?: number): PigState {
  if (hp !== undefined && hp <= 0) return "fainted";
  if (mood === "sick") return "sick";
  if (mood === "sad") return "hungry";
  return "healthy";
}

/** Native pixel-grid frame size, before the growth-stage/size scale is applied. */
const FRAME = PIXEL_COLS * PIXEL_CELL;

export function Pig({
  mood,
  level,
  color = "pink",
  accessory = "none",
  hp,
  asleep = false,
  animated = false,
  emotion,
  size = FRAME,
}: {
  mood: Mood;
  level: number;
  color?: PigColor;
  /** Cosmetic accessory the player has equipped. */
  accessory?: PigAccessory;
  /** 0–100. When supplied and 0, overrides to the fainted pose. */
  hp?: number;
  /** Forces the sleeping pose regardless of mood/hp. */
  asleep?: boolean;
  animated?: boolean;
  /** User-selected feeling from a quick check-in. */
  emotion?: AvatarEmotion | null;
  size?: number;
}) {
  const stage = stageForLevel(level);
  const state = asleep ? "sleeping" : stateForMood(mood, hp);
  const coat = COAT[color];
  const scale = STAGE_SCALE[stage] * (size / FRAME);

  const style = {
    "--pig-body": coat.body,
    "--pig-ear": coat.ear,
    "--pig-nose": coat.nose,
    "--pig-line": coat.line,
    width: size,
    height: size,
    // The pixel artwork remains a 128px canvas even when its layout box is
    // smaller. Anchor and offset that canvas so mini avatars stay centred.
    left: (size - FRAME) / 2,
    top: size - FRAME,
    transformOrigin: `${FRAME / 2}px ${FRAME}px`,
    transform: `scale(${scale})`,
  } as CSSProperties;

  return (
    <div
      className={`pig pig-stage pig-state-${state} pig-emotion-${emotion ?? mood} ${animated ? "animate-breathe" : ""}`}
      style={style}
      role="img"
      aria-label={`Pig is ${state}, ${STAGE_LABEL[stage].toLowerCase()} stage`}
    >
      {/* Everything below rides together on the state's motion (wobble,
          shiver, keeling over) so accessories never appear to float free
          of the sprite they're attached to. */}
      <div className="pig-figure">
        {stage === "master" && (
          <>
            <div className="pig-crown" />
            <span className="pig-sparkle pig-sparkle-a" />
            <span className="pig-sparkle pig-sparkle-b" />
          </>
        )}
        {state === "sick" && (
          <>
            <div className="pig-icepack" />
            <div className="pig-thermometer" />
          </>
        )}
        {state === "sleeping" && (
          <div className="pig-zzz" aria-hidden>
            z
          </div>
        )}

        <div
          className="pig-px"
          style={{
            width: PIXEL_CELL,
            height: PIXEL_CELL,
            boxShadow: PIG_PIXELS[state],
          }}
        />

        {stage === "teen" && <div className="pig-bow" />}
        {state === "hungry" && (
          <div className="pig-bubble" aria-hidden>
            🥣
          </div>
        )}
        {state === "healthy" && emotion && (
          <div className={`pig-emotion-mark pig-emotion-mark-${emotion}`} aria-hidden>
            {emotion === "happy" ? "♥" : emotion === "sad" ? "…" : emotion === "angry" ? "!" : emotion === "calm" ? "~" : "✦"}
          </div>
        )}

        {accessory === "glasses" && <div className="pig-glasses" />}
        {accessory === "flower" && (
          <div className="pig-flower">
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    </div>
  );
}

/** Exported for anything that wants to know the sprite's native square size. */
export const PIG_FRAME_SIZE = FRAME;
export const PIG_GRID_ROWS = PIXEL_ROWS;
