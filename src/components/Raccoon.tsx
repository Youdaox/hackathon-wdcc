import type { CSSProperties } from "react";
import type { AvatarEmotion, Mood, PigAccessory, RaccoonColor } from "@/lib/types";
import { RACCOON_PIXELS, PIXEL_CELL, PIXEL_COLS, PIXEL_ROWS } from "@/components/raccoonPixels";
import { stageForLevel, stateForMood, STAGE_LABEL } from "@/components/Pig";
import type { PigStage, PigState } from "@/components/Pig";

/** Coat swatches — grey tones matching the raccoon's grey/mask reference look. */
const COAT: Record<RaccoonColor, { body: string; shade: string; mask: string; belly: string; line: string }> = {
  slate: { body: "#7D7D80", shade: "#5C5C60", mask: "#2F2F32", belly: "#D8D8D4", line: "#2A2420" },
  charcoal: { body: "#6A6A6D", shade: "#4A4A4D", mask: "#242426", belly: "#CFCFCB", line: "#201C18" },
  taupe: { body: "#8B8480", shade: "#6A6460", mask: "#3A3430", belly: "#E0DAD2", line: "#2A2420" },
};

const COAT_LABEL: Record<RaccoonColor, string> = {
  slate: "Slate",
  charcoal: "Charcoal",
  taupe: "Taupe",
};

export const RACCOON_COLORS: { value: RaccoonColor; label: string; swatch: string }[] = (
  Object.keys(COAT) as RaccoonColor[]
).map((value) => ({
  value,
  label: COAT_LABEL[value],
  swatch: COAT[value].body,
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

export function Raccoon({
  mood,
  level,
  color = "slate",
  accessory = "none",
  hp,
  asleep = false,
  animated = false,
  emotion,
  size = FRAME,
}: {
  mood: Mood;
  level: number;
  color?: RaccoonColor;
  accessory?: PigAccessory;
  hp?: number;
  asleep?: boolean;
  animated?: boolean;
  emotion?: AvatarEmotion | null;
  size?: number;
}) {
  const stage = stageForLevel(level);
  const state: PigState = asleep ? "sleeping" : stateForMood(mood, hp);
  const coat = COAT[color] ?? COAT.slate;
  const scale = STAGE_SCALE[stage] * (size / FRAME);

  const style = {
    "--raccoon-body": coat.body,
    "--raccoon-shade": coat.shade,
    "--raccoon-mask": coat.mask,
    "--raccoon-belly": coat.belly,
    "--raccoon-line": coat.line,
    width: size,
    height: size,
    left: (size - FRAME) / 2,
    top: size - FRAME,
    transformOrigin: `${FRAME / 2}px ${FRAME}px`,
    transform: `scale(${scale})`,
  } as CSSProperties;

  return (
    <div
      className={`raccoon raccoon-stage raccoon-state-${state} raccoon-emotion-${emotion ?? mood} ${animated ? "animate-breathe" : ""}`}
      style={style}
      role="img"
      aria-label={`Raccoon is ${state}, ${STAGE_LABEL[stage].toLowerCase()} stage`}
    >
      <div className="raccoon-figure">
        {stage === "master" && (
          <>
            <div className="raccoon-crown" />
            <span className="raccoon-sparkle raccoon-sparkle-a" />
            <span className="raccoon-sparkle raccoon-sparkle-b" />
          </>
        )}
        {state === "sick" && (
          <>
            <div className="raccoon-icepack" />
            <div className="raccoon-thermometer" />
          </>
        )}
        {state === "sleeping" && (
          <div className="raccoon-zzz" aria-hidden>
            z
          </div>
        )}

        <div
          className="raccoon-px"
          style={{
            width: PIXEL_CELL,
            height: PIXEL_CELL,
            boxShadow: RACCOON_PIXELS[state],
          }}
        />

        {stage === "teen" && <div className="raccoon-bow" />}
        {state === "hungry" && (
          <div className="raccoon-bubble" aria-hidden>
            🥣
          </div>
        )}
        {state === "healthy" && emotion && (
          <div className={`raccoon-emotion-mark raccoon-emotion-mark-${emotion}`} aria-hidden>
            {emotion === "happy" ? "♥" : emotion === "sad" ? "…" : emotion === "angry" ? "!" : emotion === "calm" ? "~" : "✦"}
          </div>
        )}

        {accessory === "flower" && (
          <div className="raccoon-flower">
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

export const RACCOON_FRAME_SIZE = FRAME;
export const RACCOON_GRID_ROWS = PIXEL_ROWS;
