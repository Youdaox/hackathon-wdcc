import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

/**
 * Session handling for the shared account.
 *
 * The web signs in with an httpOnly `incline_session` cookie. That transport
 * doesn't survive React Native: its networking layer owns the cookie store and
 * silently drops a manually-set `Cookie` header, so every authenticated call
 * came back 401.
 *
 * So login also returns the token in the response body, and the app sends it
 * as `Authorization: Bearer` — the same token, the same server-side lookup,
 * just a header the platform won't interfere with.
 */

const TOKEN_KEY = "incline.session.v1";

export interface Account {
  id: string;
  username: string;
  name: string;
  initials: string;
}

let cachedToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  cachedToken = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  return cachedToken;
}

async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
  else await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

/** Auth header for a request, or nothing when signed out. */
export function authHeader(): Record<string, string> {
  return cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {};
}

async function authenticate(
  path: "/api/auth/login" | "/api/auth/register",
  username: string,
  password: string,
): Promise<Account> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Sign in failed.");

  const token = typeof body?.token === "string" ? body.token : null;
  if (!token) throw new Error("Server didn't return a session.");
  await setToken(token);
  return body.user as Account;
}

export function login(username: string, password: string): Promise<Account> {
  return authenticate("/api/auth/login", username, password);
}

export function register(username: string, password: string): Promise<Account> {
  return authenticate("/api/auth/register", username, password);
}

/** Who the stored token belongs to, or null if it's missing or expired. */
export async function currentAccount(): Promise<Account | null> {
  const token = await loadToken();
  if (!token) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const body = await response.json();
    // An expired token is indistinguishable from none — drop it so the app
    // shows the login screen rather than failing every call afterwards.
    if (!body?.user) {
      await setToken(null);
      return null;
    }
    return body.user as Account;
  } catch {
    // Offline: keep the token, the user is probably still signed in.
    return null;
  }
}

export async function signOut(): Promise<void> {
  const header = authHeader();
  await setToken(null);
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", headers: header });
  } catch {
    // The local token is already gone, which is what matters.
  }
}
