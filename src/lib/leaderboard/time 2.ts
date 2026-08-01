import type { LeaderboardPeriod } from "./types";

const DAY_MS = 86_400_000;

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function periodBounds(period: LeaderboardPeriod, now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  if (period === "month") {
    return {
      startsAt: new Date(Date.UTC(year, month, 1)),
      endsAt: new Date(Date.UTC(year, month + 1, 1)),
    };
  }

  const midnight = new Date(Date.UTC(year, month, date));
  const mondayOffset = (midnight.getUTCDay() + 6) % 7;
  const startsAt = new Date(midnight.getTime() - mondayOffset * DAY_MS);
  return { startsAt, endsAt: new Date(startsAt.getTime() + 7 * DAY_MS) };
}
