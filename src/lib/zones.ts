/**
 * Geolocation bonus zones — real study spots that grant an XP multiplier.
 *
 * Coordinates are approximate building centres on the University of Auckland
 * city campus. Radii are deliberately generous (~70m) because consumer GPS
 * indoors is easily 20–40m off, and a false negative on stage is worse than a
 * slightly loose boundary. To recalibrate on site, enable location in the app
 * and read the live coordinates shown under the zone card.
 */

export interface BonusZone {
  id: string;
  name: string;
  blurb: string;
  lat: number;
  lng: number;
  /** Radius in metres. */
  radiusM: number;
  /** XP multiplier applied to the session's focused time. */
  multiplier: number;
}

export const BONUS_ZONES: BonusZone[] = [
  {
    id: "general-library",
    name: "General Library",
    blurb: "Building 109 · 5 Alfred St",
    lat: -36.85243,
    lng: 174.769,
    radiusM: 70,
    multiplier: 1.5,
  },
  {
    id: "kate-edger",
    name: "Kate Edger Information Commons",
    blurb: "Building 315 · 11 Symonds St",
    lat: -36.85177,
    lng: 174.76856,
    radiusM: 70,
    multiplier: 1.5,
  },
  {
    id: "engineering",
    name: "Engineering Building",
    blurb: "Building 405 · 20 Symonds St",
    lat: -36.85278,
    lng: 174.76628,
    radiusM: 70,
    multiplier: 1.25,
  },
];

export interface ZoneMatch {
  zone: BonusZone;
  distanceM: number;
  /** True when the reading falls inside the zone radius. */
  inside: boolean;
}

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

/**
 * Closest zone to a reading, whether or not the user is inside it.
 * Returning the near-miss lets the UI say "180m from the General Library"
 * instead of just going quiet.
 */
export function nearestZone(lat: number, lng: number): ZoneMatch | null {
  if (BONUS_ZONES.length === 0) return null;
  let best: ZoneMatch | null = null;
  for (const zone of BONUS_ZONES) {
    const distanceM = distanceMeters(lat, lng, zone.lat, zone.lng);
    if (!best || distanceM < best.distanceM) {
      best = { zone, distanceM, inside: distanceM <= zone.radiusM };
    }
  }
  return best;
}

/**
 * The zone the user is currently inside, if any. When zones overlap, the
 * highest multiplier wins so the user is never penalised for ambiguity.
 */
export function activeZone(lat: number, lng: number): BonusZone | null {
  let best: BonusZone | null = null;
  for (const zone of BONUS_ZONES) {
    if (distanceMeters(lat, lng, zone.lat, zone.lng) <= zone.radiusM) {
      if (!best || zone.multiplier > best.multiplier) best = zone;
    }
  }
  return best;
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1)}km`;
}
