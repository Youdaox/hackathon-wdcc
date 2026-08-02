import Constants from "expo-constants";

/**
 * Backend base URL, read from `expo.extra.apiBaseUrl` in app.json.
 *
 * It lives in config rather than a constant here because the LAN address
 * changes every time the laptop rejoins wifi, and in Expo Go a config edit is
 * a reload rather than a rebuild.
 *
 * Plain http on purpose: the repo's dev cert is self-signed, and React
 * Native's networking stack rejects untrusted certificates outright with no
 * way to click through the way a browser does.
 */
/**
 * Backend base URL.
 *
 * Derived from the Expo dev server the app is already talking to, because that
 * address is correct by construction: the simulator sees `localhost`, a
 * physical phone sees the LAN IP, and both follow the laptop onto a new
 * network without anyone editing a config file. Chasing a hardcoded IP through
 * every wifi change was a recurring source of "can't reach the server".
 *
 * `expo.extra.apiBaseUrl` still wins when set, for pointing at a deployed
 * backend, and is the fallback in a production build where there is no dev
 * server to infer from.
 */
function resolveApiBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  if (configured && configured.trim()) return configured.trim();

  // e.g. "172.20.10.154:8081" or "localhost:8081"
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.linkingUri ?? "";
  const host = hostUri.split("/")[0].split(":")[0];
  if (host) return `http://${host}:3000`;

  return "http://localhost:3000";
}

export const API_BASE_URL: string = resolveApiBaseUrl();

/**
 * There is no auth, so identity is just a string both sides agree on. Pinned
 * to one value so the phone and the seeded demo data share a pet.
 */
export const USER_ID = "demo-user";

/**
 * Matches RULES.graceMs in the web app: a stretch shorter than this costs
 * focus time but not HP, so an accidental app-switch isn't punished.
 */
export const GRACE_MS = 5_000;

/**
 * How long you must be away before the interruption screen fires on return.
 *
 * Effectively "any real departure". The 1s floor is not a grace period — it
 * exists because iOS reports `inactive` for things that aren't leaving at all:
 * pulling down Control Centre, a call banner, the app switcher preview. Those
 * resolve in well under a second, and interrupting on them would make the app
 * feel broken.
 *
 * Set to 0 to interrupt on absolutely every AppState change.
 */
export const CHECKPOINT_MIN_MS = 1_000;



/**
 * What leaving costs.
 *
 * Three parts, deliberately front-loaded: a flat hit the instant you pick the
 * phone up, a steady drain while you're gone, and a steeper rate once you've
 * been away long enough that it isn't a glance any more. The escalation is the
 * point — a five-second check shouldn't feel like a five-minute scroll.
 *
 * Duplicated in `src/app/api/sessions/route.ts`; the two must agree or the
 * live number will contradict what the server writes on sync.
 */
export const HP_LEAVE_PENALTY = 5;
export const HP_DRAIN_PER_AWAY_MINUTE = 2;
export const HP_ESCALATE_AFTER_MS = 30_000;
export const HP_ESCALATED_MULTIPLIER = 3;

/** HP lost for a single away stretch of `awayMs`. */
export function hpCostForAway(awayMs: number): number {
  if (awayMs <= 0) return 0;
  const base = HP_LEAVE_PENALTY;
  const steady = (Math.min(awayMs, HP_ESCALATE_AFTER_MS) / 60_000) * HP_DRAIN_PER_AWAY_MINUTE;
  const overrun = Math.max(0, awayMs - HP_ESCALATE_AFTER_MS);
  const escalated =
    (overrun / 60_000) * HP_DRAIN_PER_AWAY_MINUTE * HP_ESCALATED_MULTIPLIER;
  return base + steady + escalated;
}

/**
 * Location opt-in, mirroring the web's `incline.geo.v1`.
 *
 * Nothing prompts for location until this is true. Keeping it explicit is the
 * point: the bonus is additive, so the permission dialog should never be the
 * first thing a new user meets.
 */
export const GEO_OPT_IN_KEY = "incline.geo.v1";
