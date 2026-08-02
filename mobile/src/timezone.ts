export const NEW_ZEALAND_TIME_ZONE = "Pacific/Auckland";

export function nzClock(value: Date | number): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: NEW_ZEALAND_TIME_ZONE,
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(value);
}
