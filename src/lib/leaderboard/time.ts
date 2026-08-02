import type { LeaderboardPeriod } from "./types";
import { addNewZealandDays, newZealandDate, nzDateKey, nzParts, nzStartOfDay } from "../timezone";

export function dayKey(date: Date): string {
  return nzDateKey(date);
}

export function periodBounds(period: LeaderboardPeriod, now: Date) {
  const { year, month, weekday } = nzParts(now);

  if (period === "month") {
    return {
      startsAt: newZealandDate(year, month, 1),
      endsAt: newZealandDate(year, month + 1, 1),
    };
  }

  const mondayOffset = (weekday + 6) % 7;
  const startsAt = addNewZealandDays(nzStartOfDay(now), -mondayOffset);
  return { startsAt, endsAt: addNewZealandDays(startsAt, 7) };
}
