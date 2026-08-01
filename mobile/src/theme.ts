import type { Companion } from "./api";

export const colors = {
  bg: "#0f1511",
  surface: "#18211b",
  surfaceAlt: "#1f2a23",
  border: "#2b3a30",
  text: "#e8f0ea",
  muted: "#8ea396",
  accent: "#7bd88f",
  warn: "#e0b155",
  bad: "#e07a5f",
} as const;

/** Emoji stand-in for real art, matching the web app's faceFor(). */
export function faceFor(mood: Companion["mood"], level: number): string {
  if (mood === "sick") return "🥀";
  if (mood === "sad") return "🌱";
  if (level >= 8) return mood === "happy" ? "🌳" : "🪴";
  if (level >= 4) return mood === "happy" ? "🪴" : "🌿";
  return mood === "happy" ? "🌿" : "🌱";
}

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
