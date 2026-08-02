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
 * How long you can be away from a *pledged* session before it dies.
 *
 * This is the only hard rule in the app. It works because it restricts the one
 * thing we genuinely control — the session — instead of pretending to control
 * the phone. No permissions, no setup, nothing to configure.
 *
 * Open-ended sessions are unaffected: stakes are opt-in.
 */
export const PLEDGE_ABANDON_MS = 60_000;
