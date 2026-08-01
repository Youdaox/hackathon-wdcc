import * as Location from "expo-location";
import type { StudySpot } from "./api";

/**
 * Location check-in, ported from the web app's zone logic.
 *
 * One fix at session start, never continuous tracking — the app asks for
 * "when in use" only and takes a single reading. Location is strictly
 * additive: every failure path resolves to "no reading" and a 1x session,
 * never an error state and never a reason a session can't run.
 */

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export interface SpotMatch {
  spot: StudySpot;
  distanceM: number;
  inside: boolean;
}

/**
 * Closest spot to a reading, whether or not the user is inside it. Returning
 * the near-miss lets the UI say "180m from the General Library" instead of
 * going quiet.
 */
export function nearestSpot(
  lat: number,
  lng: number,
  spots: StudySpot[],
): SpotMatch | null {
  let best: SpotMatch | null = null;
  for (const spot of spots) {
    const distanceM = distanceMeters(lat, lng, spot.lat, spot.lng);
    if (!best || distanceM < best.distanceM) {
      best = { spot, distanceM, inside: distanceM <= spot.radius_m };
    }
  }
  return best;
}

/**
 * The spot the user is currently inside, if any. When spots overlap the
 * highest multiplier wins, so ambiguity never costs the user.
 */
export function activeSpot(lat: number, lng: number, spots: StudySpot[]): StudySpot | null {
  let best: StudySpot | null = null;
  for (const spot of spots) {
    if (distanceMeters(lat, lng, spot.lat, spot.lng) <= spot.radius_m) {
      if (!best || spot.multiplier > best.multiplier) best = spot;
    }
  }
  return best;
}

export interface Reading {
  lat: number;
  lng: number;
}

/**
 * A single position fix, or null if we couldn't get one.
 *
 * Denied, unsupported and timed-out all collapse to null rather than throwing:
 * to the rest of the app "no reading" is one state, and none of them should
 * interrupt a focus session.
 */
export async function getReading(): Promise<Reading | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return null;
  }
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1)}km`;
}
