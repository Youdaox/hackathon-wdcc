import { cookies } from "next/headers";

/**
 * Canvas login session.
 *
 * The access token is a bearer credential for the user's whole Canvas account —
 * grades, submissions, messages. So it is held in an **httpOnly** cookie and
 * never handed to client JavaScript: the browser attaches it automatically on
 * same-origin requests to `/api/graphql`, and an XSS bug can't read it back out
 * the way it could read `localStorage`.
 *
 * The cookie is a session cookie (no `maxAge`), so closing the browser ends the
 * connection — appropriate for a shared lab machine.
 */

export const CANVAS_COOKIE = "incline_canvas";

export interface CanvasSession {
  baseUrl: string;
  token: string;
}

/** Reads the connected Canvas account, or null when nobody is logged in. */
export async function readSession(): Promise<CanvasSession | null> {
  const raw = (await cookies()).get(CANVAS_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CanvasSession>;
    if (typeof parsed.baseUrl !== "string" || typeof parsed.token !== "string") return null;
    return { baseUrl: parsed.baseUrl, token: parsed.token };
  } catch {
    // Tampered or truncated cookie — treat as logged out rather than erroring.
    return null;
  }
}

export async function writeSession(session: CanvasSession): Promise<void> {
  (await cookies()).set(CANVAS_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    // localhost is http during a demo; Secure would drop the cookie entirely.
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(CANVAS_COOKIE);
}

/**
 * Normalises whatever the user pasted into an instance root.
 *
 * People paste the URL they're looking at — `canvas.auckland.ac.nz/courses/123`,
 * or no scheme at all — so take the origin and assume https.
 */
export function normaliseBaseUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.origin;
  } catch {
    return null;
  }
}
