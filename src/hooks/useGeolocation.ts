"use client";

import { useEffect, useState } from "react";

export type GeoStatus =
  /** User hasn't opted in — we never prompt unasked. */
  | "off"
  /** Browser has no Geolocation API at all. */
  | "unsupported"
  /** Opted in, waiting on the permission prompt or the first fix. */
  | "locating"
  /** Receiving positions. */
  | "granted"
  /** User said no. The app carries on at 1× and stops asking. */
  | "denied"
  /** Position unavailable or timed out — transient, unlike denied. */
  | "error";

/** Everything the watch itself can report; "off" is derived, not stored. */
type WatchStatus = Exclude<GeoStatus, "off">;

export interface GeoReading {
  lat: number;
  lng: number;
  /** Reported accuracy radius in metres. */
  accuracyM: number;
  at: number;
}

/**
 * Watches the user's position while `enabled` is true.
 *
 * Location is strictly a bonus: every failure path (unsupported, denied,
 * timeout) resolves to "no reading", and callers treat that as a 1× multiplier
 * rather than an error state. Nothing here can block a focus session.
 */
export function useGeolocation(enabled: boolean) {
  const [watchStatus, setWatchStatus] = useState<WatchStatus>("locating");
  const [reading, setReading] = useState<GeoReading | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (!("geolocation" in navigator)) {
      // The only branch that has to set state synchronously — support can't be
      // detected during render without breaking SSR.
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setWatchStatus("unsupported");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setWatchStatus("granted");
        setReading({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          at: position.timestamp,
        });
      },
      (err) => {
        // Only a denial is permanent; the rest may recover on the next fix,
        // so we keep the watch alive and leave any last good reading in place.
        setWatchStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  // Derived rather than stored, so toggling off can't leave a stale zone or
  // multiplier applied to the next session.
  return {
    status: enabled ? watchStatus : ("off" as const),
    reading: enabled ? reading : null,
  };
}
