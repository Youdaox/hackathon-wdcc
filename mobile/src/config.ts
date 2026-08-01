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
