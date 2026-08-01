"use client";

import { useEffect, useState } from "react";

/**
 * A clock that re-renders on an interval, so schedule countdowns stay live
 * without calling `Date.now()` during render.
 *
 * Returns `null` on the first render (and on the server) so nothing
 * time-dependent is emitted before hydration.
 */
export function useNow(intervalMs = 15_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  // Seeding the clock after mount is the point of this hook — the server has
  // no "now" to render, so the first paint deliberately has none either.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return now;
}
