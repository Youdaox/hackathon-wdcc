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
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? "http://localhost:3000";

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
