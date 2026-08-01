/**
 * Thin localStorage wrapper. SSR-safe (returns the fallback on the server) and
 * never throws — a corrupt or unavailable store just falls back to defaults.
 */

export const STORAGE_KEYS = {
  schedule: "incline.schedule.v1",
  companion: "incline.companion.v1",
  sessions: "incline.sessions.v1",
  geo: "incline.geo.v1",
} as const;

export function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private-mode failure — the app keeps working in memory.
  }
}

export function clearAll(): void {
  if (typeof window === "undefined") return;
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/** crypto.randomUUID with a fallback for non-secure contexts. */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
