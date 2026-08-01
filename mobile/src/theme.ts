import { Platform } from "react-native";
import type { Companion } from "./api";

export const colors = {
  bg: "#fbf7f0",
  surface: "#ffffff",
  surfaceAlt: "#f2f7f3",
  border: "#e5e7e5",
  text: "#373128",
  muted: "#918a79",
  accent: "#56ad70",
  accentSoft: "#84c695",
  accentPale: "#c0dfc5",
  peach: "#ef8c66",
  peachPale: "#f9d9c5",
  sand: "#dbc9b1",
  nav: "#b7ad96",
  warn: "#d5aa58",
  bad: "#d67262",
} as const;

export const roundedFont = Platform.select({
  ios: "Arial Rounded MT Bold",
  android: "sans-serif-rounded",
  default: undefined,
});

export const MOOD_LABEL: Record<Companion["mood"], string> = {
  happy: "Thriving",
  neutral: "Steady",
  sad: "Wilting",
  sick: "Struggling",
};

export function moodColor(mood: Companion["mood"]): string {
  if (mood === "happy") return colors.accent;
  if (mood === "neutral") return colors.text;
  if (mood === "sad") return colors.warn;
  return colors.bad;
}

/** mm:ss, or h:mm:ss once a session runs past an hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
