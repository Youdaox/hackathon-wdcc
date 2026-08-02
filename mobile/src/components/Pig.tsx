import { StyleSheet, View } from "react-native";
import { PIG_RECTS, PIXEL_COLS, PIXEL_ROWS, type PigRect, type PigTone } from "./pigPixels";

/**
 * The pig, ported from the web `Pig.tsx`.
 *
 * The web draws the sprite as one CSS `box-shadow` with ~570 entries and
 * recolours it through `--pig-*` custom properties. Neither exists in React
 * Native, so the same source data is pre-compiled into horizontal runs (see
 * `scripts/gen-pig-pixels.ts`) and drawn as absolutely-positioned views —
 * about 160 per pig rather than 570.
 *
 * Coats, growth stages and pose selection are copied from the web verbatim so
 * a level-5 pink pig looks the same in both places.
 */

export type PigColor = "pink" | "purple" | "blue";
export type PigAccessory = "none" | "glasses" | "flower";
export type PigState = "healthy" | "hungry" | "sick" | "sleeping" | "fainted";
export type PigStage = "baby" | "little" | "young" | "teen" | "master";
export type Mood = "happy" | "neutral" | "sad" | "sick";

const COAT: Record<PigColor, { body: string; ear: string; nose: string; line: string }> = {
  pink: { body: "#FFC1CD", ear: "#FF97AC", nose: "#FFB9C4", line: "#6B3F35" },
  purple: { body: "#E6D9FA", ear: "#D5C0F3", nose: "#DCC7F5", line: "#5A4A63" },
  blue: { body: "#D7EAFB", ear: "#BEDCF4", nose: "#C7E2F7", line: "#3F5A66" },
};

export const PIG_COLORS: { value: PigColor; label: string; swatch: string }[] = [
  { value: "pink", label: "Pink", swatch: COAT.pink.body },
  { value: "purple", label: "Lavender", swatch: COAT.purple.body },
  { value: "blue", label: "Sky", swatch: COAT.blue.body },
];

export const PIG_ACCESSORIES: { value: PigAccessory; label: string }[] = [
  { value: "none", label: "None" },
  { value: "glasses", label: "Glasses" },
  { value: "flower", label: "Flower" },
];

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

/** Five growth stages across the level range, mirroring the web's XP tiers. */
export function stageForLevel(level: number): PigStage {
  if (level >= 9) return "master";
  if (level >= 7) return "teen";
  if (level >= 5) return "young";
  if (level >= 3) return "little";
  return "baby";
}

/** The pig's posture — a simplified view of mood plus HP. */
export function stateForMood(mood: Mood, hp?: number): PigState {
  if (hp !== undefined && hp <= 0) return "fainted";
  if (mood === "sick") return "sick";
  if (mood === "sad") return "hungry";
  return "healthy";
}

/** Resolves a tone name against the coat, including the shade/light mixes. */
function toneColor(tone: PigTone, coat: (typeof COAT)[PigColor]): string {
  switch (tone) {
    case "line":
      return coat.line;
    case "ear":
      return coat.ear;
    case "body":
      return coat.body;
    case "nose":
      return coat.nose;
    case "earShade":
      return mix(coat.ear, "#000000", 0.88);
    case "earLight":
      return mix(coat.ear, "#ffffff", 0.65);
    case "bodyShade":
      return mix(coat.body, "#000000", 0.88);
    case "bodyLight":
      return mix(coat.body, "#ffffff", 0.65);
    case "noseShade":
      return mix(coat.nose, "#000000", 0.9);
  }
}

/** Stand-in for CSS `color-mix(in srgb, a P%, b)`. */
function mix(a: string, b: string, weight: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = (i: number) => Math.round(pa[i] * weight + pb[i] * (1 - weight));
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function Pig({
  mood,
  level,
  color = "pink",
  accessory = "none",
  hp,
  asleep = false,
  size = 128,
}: {
  mood: Mood;
  level: number;
  color?: PigColor;
  accessory?: PigAccessory;
  /** 0-100. When supplied and 0, overrides to the fainted pose. */
  hp?: number;
  asleep?: boolean;
  size?: number;
}) {
  const state: PigState = asleep ? "sleeping" : stateForMood(mood, hp);
  const coat = COAT[color];
  const rects: PigRect[] = PIG_RECTS[state] ?? PIG_RECTS.healthy;

  // One cell is sized so the 32-cell grid fills `size`, then the growth stage
  // scales the whole figure — a baby pig occupies the same box as a master,
  // it just doesn't fill it.
  const stageScale = STAGE_SCALE[stageForLevel(level)];
  const cell = (size / PIXEL_COLS) * stageScale;
  const drawn = cell * PIXEL_COLS;
  const offsetX = (size - drawn) / 2;
  const offsetY = size - cell * PIXEL_ROWS;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {rects.map(([x, y, w, tone], i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: offsetX + x * cell,
            top: offsetY + y * cell,
            // +0.5 closes the hairline seams that appear between adjacent
            // runs once the cell size lands on a fractional pixel.
            width: w * cell + 0.5,
            height: cell + 0.5,
            backgroundColor: toneColor(tone, coat),
          }}
        />
      ))}
      {accessory !== "none" && (
        <Accessory kind={accessory} cell={cell} offsetX={offsetX} offsetY={offsetY} />
      )}
    </View>
  );
}

/**
 * Accessories are drawn from grid coordinates rather than the sprite sheet, so
 * they scale with the pig and stay attached at every growth stage.
 */
function Accessory({
  kind,
  cell,
  offsetX,
  offsetY,
}: {
  kind: Exclude<PigAccessory, "none">;
  cell: number;
  offsetX: number;
  offsetY: number;
}) {
  const at = (x: number, y: number, w: number, h: number, backgroundColor: string, extra = {}) => ({
    position: "absolute" as const,
    left: offsetX + x * cell,
    top: offsetY + y * cell,
    width: w * cell,
    height: h * cell,
    backgroundColor,
    ...extra,
  });

  if (kind === "glasses") {
    return (
      <>
        <View style={at(8, 13, 5, 4, "transparent", { borderWidth: cell, borderColor: "#3f3a34" })} />
        <View style={at(19, 13, 5, 4, "transparent", { borderWidth: cell, borderColor: "#3f3a34" })} />
        <View style={at(13, 14, 6, 1, "#3f3a34")} />
      </>
    );
  }

  return (
    <>
      <View style={at(7, 6, 2, 2, "#e79ac0", { borderRadius: cell })} />
      <View style={at(9, 5, 2, 2, "#f4b8d4", { borderRadius: cell })} />
      <View style={at(9, 8, 2, 2, "#f4b8d4", { borderRadius: cell })} />
      <View style={at(9, 6.5, 2, 2, "#f6d879", { borderRadius: cell })} />
    </>
  );
}

const styles = StyleSheet.create({
  frame: { position: "relative" },
});
