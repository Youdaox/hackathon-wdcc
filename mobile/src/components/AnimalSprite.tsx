import { StyleSheet, View } from "react-native";
import { COW_RECTS, PIXEL_COLS as COW_COLS, PIXEL_ROWS as COW_ROWS } from "./cowPixels";
import {
  RACCOON_RECTS,
  PIXEL_COLS as RACCOON_COLS,
  PIXEL_ROWS as RACCOON_ROWS,
} from "./raccoonPixels";
import { Pig, type Mood, stageForLevel, stateForMood } from "./Pig";

/**
 * Renders whichever companion the account owns.
 *
 * The pig keeps its own component because its sprite recolours through named
 * tones; cow and raccoon share this one, since both were generated from a
 * literal-hex source by `scripts/gen-animal-pixels.ts`. A tone that is itself
 * a hex is a fixed detail — hooves, eye whites — and renders as-is.
 */

export type AnimalSpecies = "pig" | "cow" | "raccoon";

const COW_COAT: Record<string, Record<string, string>> = {
  sky: { body: "#FFFFFF", shade: "#DBE6F5", horn: "#3A6FB5", nose: "#F2879C", line: "#2C2C2C" },
  mint: { body: "#FFFFFF", shade: "#DCF3EA", horn: "#3AAE8C", nose: "#F2A98F", line: "#2C2C2C" },
  lilac: { body: "#FFFFFF", shade: "#EAE0F7", horn: "#8A6FC9", nose: "#F2A0C9", line: "#2C2C2C" },
};

const RACCOON_COAT: Record<string, Record<string, string>> = {
  slate: { body: "#7D7D80", shade: "#5C5C60", mask: "#2F2F32", belly: "#D8D8D4", line: "#2A2420" },
  charcoal: {
    body: "#6A6A6D",
    shade: "#4A4A4D",
    mask: "#242426",
    belly: "#CFCFCB",
    line: "#201C18",
  },
  taupe: { body: "#8B8480", shade: "#6A6460", mask: "#3A3430", belly: "#E0DAD2", line: "#2A2420" },
};

export const SPECIES_COLORS: Record<AnimalSpecies, string[]> = {
  pig: ["pink", "purple", "blue"],
  cow: ["sky", "mint", "lilac"],
  raccoon: ["slate", "charcoal", "taupe"],
};

/** Swatch shown in the coat picker — the most identifying colour per species. */
export function swatchFor(species: AnimalSpecies, color: string): string {
  if (species === "cow") return COW_COAT[color]?.horn ?? "#3A6FB5";
  if (species === "raccoon") return RACCOON_COAT[color]?.body ?? "#7D7D80";
  return { pink: "#FFC1CD", purple: "#E6D9FA", blue: "#D7EAFB" }[color] ?? "#FFC1CD";
}

const STAGE_SCALE: Record<string, number> = {
  baby: 0.6,
  little: 0.75,
  young: 0.9,
  teen: 1,
  master: 1.15,
};

export function AnimalSprite({
  species,
  mood,
  level,
  color,
  hp,
  asleep = false,
  size = 128,
}: {
  species: AnimalSpecies;
  mood: Mood;
  level: number;
  color: string;
  hp?: number;
  asleep?: boolean;
  size?: number;
}) {
  if (species === "pig") {
    const pigColor = (["pink", "purple", "blue"].includes(color) ? color : "pink") as
      | "pink"
      | "purple"
      | "blue";
    return <Pig mood={mood} level={level} color={pigColor} hp={hp} asleep={asleep} size={size} />;
  }

  const isCow = species === "cow";
  const rects = isCow ? COW_RECTS : RACCOON_RECTS;
  const cols = isCow ? COW_COLS : RACCOON_COLS;
  const rows = isCow ? COW_ROWS : RACCOON_ROWS;
  const palette = isCow
    ? (COW_COAT[color] ?? COW_COAT.sky)
    : (RACCOON_COAT[color] ?? RACCOON_COAT.slate);

  const state = asleep ? "sleeping" : stateForMood(mood, hp);
  const frame = rects[state] ?? rects.healthy;

  const stageScale = STAGE_SCALE[stageForLevel(level)] ?? 1;
  const cell = (size / cols) * stageScale;
  const drawn = cell * cols;
  const offsetX = (size - drawn) / 2;
  const offsetY = size - cell * rows;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {frame.map(([x, y, w, tone], i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: offsetX + x * cell,
            top: offsetY + y * cell,
            // +0.5 closes the hairline seams that appear between adjacent runs
            // when the cell size lands on a fractional pixel.
            width: w * cell + 0.5,
            height: cell + 0.5,
            backgroundColor: tone.startsWith("#") ? tone : (palette[tone] ?? tone),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: "relative" },
});
