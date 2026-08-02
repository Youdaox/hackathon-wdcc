import type {
  AnimalSpecies,
  AvatarEmotion,
  CompanionColor,
  CowColor,
  Mood,
  PigAccessory,
  PigColor,
  RaccoonColor,
} from "@/lib/types";
import { ANIMAL_SPECIES_VALUES } from "@/lib/types";
import { Pig, PIG_COLORS } from "@/components/Pig";
import { Cow, COW_COLORS } from "@/components/Cow";
import { Raccoon, RACCOON_COLORS } from "@/components/Raccoon";

const SPECIES_LABEL: Record<AnimalSpecies, string> = {
  pig: "Pig",
  cow: "Cow",
  raccoon: "Raccoon",
};

const SPECIES_EMOJI: Record<AnimalSpecies, string> = {
  pig: "🐷",
  cow: "🐮",
  raccoon: "🦝",
};

export const ANIMAL_SPECIES_OPTIONS: { value: AnimalSpecies; label: string; emoji: string }[] =
  ANIMAL_SPECIES_VALUES.map((value) => ({
    value,
    label: SPECIES_LABEL[value],
    emoji: SPECIES_EMOJI[value],
  }));

/** Which coat-color swatches to offer, per species — each has its own palette. */
export const COLOR_OPTIONS_BY_SPECIES: Record<
  AnimalSpecies,
  { value: CompanionColor; label: string; swatch: string }[]
> = {
  pig: PIG_COLORS,
  cow: COW_COLORS,
  raccoon: RACCOON_COLORS,
};

/**
 * Picks the right sprite component for the companion's species. Pig, Cow, and
 * Raccoon are entirely separate components with their own pixel art and coat
 * palettes — this is just the switch that picks between them, so call sites
 * don't need to know which one they're dealing with.
 */
export function AnimalSprite({
  species,
  color,
  ...rest
}: {
  species: AnimalSpecies;
  color: CompanionColor;
  mood: Mood;
  level: number;
  accessory?: PigAccessory;
  hp?: number;
  asleep?: boolean;
  animated?: boolean;
  emotion?: AvatarEmotion | null;
  size?: number;
}) {
  if (species === "cow") return <Cow color={color as CowColor} {...rest} />;
  if (species === "raccoon") return <Raccoon color={color as RaccoonColor} {...rest} />;
  return <Pig color={color as PigColor} {...rest} />;
}
