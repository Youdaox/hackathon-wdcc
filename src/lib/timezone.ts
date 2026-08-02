/** The application's canonical civil time zone. DST is handled by Intl. */
export const NEW_ZEALAND_TIME_ZONE = "Pacific/Auckland";

export type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

const fields = new Intl.DateTimeFormat("en-NZ", {
  timeZone: NEW_ZEALAND_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
});
const weekdayNumber: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Calendar fields for an instant as observed in New Zealand. */
export function nzParts(value: Date | number = new Date()): ZonedDateParts {
  const parts = Object.fromEntries(fields.formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    weekday: weekdayNumber[parts.weekday], hour: Number(parts.hour), minute: Number(parts.minute),
  };
}

export function nzDateKey(value: Date | number = new Date()): string {
  const { year, month, day } = nzParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Converts a New Zealand wall-clock date/time to an instant. */
export function newZealandDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  // The offset depends on the instant around daylight-saving changes.
  for (let i = 0; i < 3; i++) {
    const actual = nzParts(new Date(instant));
    const asUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    instant += target - asUtc;
  }
  return new Date(instant);
}

export function nzStartOfDay(value: Date | number = new Date()): Date {
  const { year, month, day } = nzParts(value);
  return newZealandDate(year, month, day);
}

/** Adds civil calendar days in New Zealand, preserving midnight across DST. */
export function addNewZealandDays(value: Date | number, days: number): Date {
  const { year, month, day } = nzParts(value);
  const target = new Date(Date.UTC(year, month - 1, day + days));
  return newZealandDate(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate());
}
