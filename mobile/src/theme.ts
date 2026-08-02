import { Platform, useColorScheme } from "react-native";

/**
 * Design tokens, ported from the web app's `globals.css`.
 *
 * Identical hex values, so the phone and the browser read as one product. The
 * web drives these through CSS custom properties and a `data-theme` attribute;
 * React Native has no cascade, so they're plain objects selected by
 * `useTheme()` instead.
 *
 * The short aliases (`bg`, `text`, `accent`, …) are the names the mobile
 * screens already use. Keeping them pointed at the web values re-skins the
 * whole app without touching every StyleSheet.
 */

/** Widened to string so the dark palette isn't checked against literal hexes. */
const light: Record<string, string> = {
  // Web token names.
  canvas: "#faf6ef",
  surface: "#ffffff",
  surface2: "#f1eadd",
  line: "#e5dcca",
  lineSoft: "#eee6d7",
  ink: "#2e2a24",
  muted: "#7c7268",
  faint: "#a89c8c",
  moss: "#4f9e74",
  mossDeep: "#2e6b4c",
  citrus: "#cf9a34",
  amber: "#db8f49",
  clay: "#cf6a50",

  // Aliases used by the existing mobile screens.
  bg: "#faf6ef",
  surfaceAlt: "#f1eadd",
  border: "#e5dcca",
  text: "#2e2a24",
  accent: "#4f9e74",
  accentSoft: "#7bbd97",
  accentPale: "#cfe6da",
  peach: "#db8f49",
  peachPale: "#eee6d7",
  sand: "#f1eadd",
  nav: "#a89c8c",
  warn: "#cf9a34",
  bad: "#cf6a50",
};

const dark: Record<string, string> = {
  canvas: "#101412",
  surface: "#18201c",
  surface2: "#222b26",
  line: "#303b34",
  lineSoft: "#28332d",
  ink: "#edf3ee",
  muted: "#a4b3a9",
  faint: "#728178",
  moss: "#72cf8c",
  mossDeep: "#3f8856",
  citrus: "#c4da84",
  amber: "#e0ae6c",
  clay: "#f08d73",

  bg: "#101412",
  surfaceAlt: "#222b26",
  border: "#303b34",
  text: "#edf3ee",
  accent: "#72cf8c",
  accentSoft: "#4f9e74",
  accentPale: "#2b3a31",
  peach: "#e0ae6c",
  peachPale: "#28332d",
  sand: "#222b26",
  nav: "#728178",
  warn: "#c4da84",
  bad: "#f08d73",
};

export type Palette = Record<string, string>;

export function useTheme(): { colors: Palette; isDark: boolean } {
  const isDark = useColorScheme() === "dark";
  return { colors: isDark ? dark : light, isDark };
}

/**
 * Static palette for module-scope StyleSheets.
 *
 * Light values, because a StyleSheet is built once at import time and cannot
 * react to the system theme. Screens that need to follow dark mode read
 * `useTheme()` and apply colours inline on top.
 */
export const colors = light;

export const roundedFont = Platform.select({
  ios: "Avenir Next",
  default: undefined,
});

/** Matches the web's --radius-card (1.75rem). */
export const radius = { card: 28, control: 16 } as const;

/** mm:ss, or h:mm:ss once a session runs past an hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
