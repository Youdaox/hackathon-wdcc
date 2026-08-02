import type { CSSProperties } from "react";
import type { AvatarEmotion, CowColor, Mood, PigAccessory } from "@/lib/types";
import { COW_PIXELS, PIXEL_CELL, PIXEL_COLS, PIXEL_ROWS } from "@/components/cowPixels";
import { stageForLevel, stateForMood, STAGE_LABEL } from "@/components/Pig";
import type { PigStage, PigState } from "@/components/Pig";

/** Coat swatches — pastel accents over the cow's white/blue reference look. */
const COAT: Record<CowColor, { body: string; shade: string; horn: string; nose: string; line: string }> = {
  sky: { body: "#FFFFFF", shade: "#DBE6F5", horn: "#3A6FB5", nose: "#F2879C", line: "#2C2C2C" },
  mint: { body: "#FFFFFF", shade: "#DCF3EA", horn: "#3AAE8C", nose: "#F2A98F", line: "#2C2C2C" },
  lilac: { body: "#FFFFFF", shade: "#EAE0F7", horn: "#8A6FC9", nose: "#F2A0C9", line: "#2C2C2C" },
};

const COAT_LABEL: Record<CowColor, string> = {
  sky: "Sky",
  mint: "Mint",
  lilac: "Lilac",
};

export const COW_COLORS: { value: CowColor; label: string; swatch: string }[] = (
  Object.keys(COAT) as CowColor[]
).map((value) => ({
  value,
  label: COAT_LABEL[value],
  swatch: COAT[value].horn,
}));

/** Native pixel-grid frame size, before the growth-stage/size scale is applied. */
const FRAME = PIXEL_COLS * PIXEL_CELL;

const STAGE_SCALE: Record<PigStage, number> = {
  baby: 0.6,
  little: 0.75,
  young: 0.9,
  teen: 1,
  master: 1.15,
};

export function Cow({
  mood,
  level,
  color = "sky",
  accessory = "none",
  hp,
  asleep = false,
  animated = false,
  emotion,
  size = FRAME,
}: {
  mood: Mood;
  level: number;
  color?: CowColor;
  accessory?: PigAccessory;
  hp?: number;
  asleep?: boolean;
  animated?: boolean;
  emotion?: AvatarEmotion | null;
  size?: number;
}) {
  const stage = stageForLevel(level);
  const state: PigState = asleep ? "sleeping" : stateForMood(mood, hp);
  const coat = COAT[color] ?? COAT.sky;
  const scale = STAGE_SCALE[stage] * (size / FRAME);

  const style = {
    "--cow-body": coat.body,
    "--cow-shade": coat.shade,
    "--cow-horn": coat.horn,
    "--cow-nose": coat.nose,
    "--cow-line": coat.line,
    width: size,
    height: size,
    left: (size - FRAME) / 2,
    top: size - FRAME,
    transformOrigin: `${FRAME / 2}px ${FRAME}px`,
    transform: `scale(${scale})`,
  } as CSSProperties;

  return (
    <div
      className={`cow cow-stage cow-state-${state} cow-emotion-${emotion ?? mood} ${animated ? "animate-breathe" : ""}`}
      style={style}
      role="img"
      aria-label={`Cow is ${state}, ${STAGE_LABEL[stage].toLowerCase()} stage`}
    >
      <div className="cow-figure">
        {stage === "master" && (
          <>
            <div className="cow-crown" />
            <span className="cow-sparkle cow-sparkle-a" />
            <span className="cow-sparkle cow-sparkle-b" />
          </>
        )}
        {state === "sick" && (
          <>
            <div className="cow-icepack" />
            <div className="cow-thermometer" />
          </>
        )}
        {state === "sleeping" && (
          <div className="cow-zzz" aria-hidden>
            z
          </div>
        )}

        <div
          className="cow-px"
          style={{
            width: PIXEL_CELL,
            height: PIXEL_CELL,
            boxShadow: COW_PIXELS[state],
          }}
        />

        {stage === "teen" && <div className="cow-bow" />}
        {state === "hungry" && (
          <div className="cow-bubble" aria-hidden>
            🥣
          </div>
        )}
        {state === "healthy" && emotion && (
          <div className={`cow-emotion-mark cow-emotion-mark-${emotion}`} aria-hidden>
            {emotion === "happy" ? "♥" : emotion === "sad" ? "…" : emotion === "angry" ? "!" : emotion === "calm" ? "~" : "✦"}
          </div>
        )}

        {accessory === "flower" && (
          <div className="cow-flower">
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

export const COW_FRAME_SIZE = FRAME;
export const COW_GRID_ROWS = PIXEL_ROWS;
