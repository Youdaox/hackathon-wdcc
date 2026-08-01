import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { authSessions, users } from "@/lib/db/schema";

const COOKIE_NAME = "incline_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 14;
const HASH_KEY_LENGTH = 64;

export type AuthUser = { id: string; username: string; name: string; initials: string };

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toUser(row: typeof users.$inferSelect): AuthUser {
  const name = row.displayName;
  return { id: row.id, username: row.username, name, initials: name.slice(0, 2).toUpperCase() };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, HASH_KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, HASH_KEY_LENGTH).toString("hex");
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(derived, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validateCredentials(username: unknown, password: unknown) {
  const normalized = typeof username === "string" ? username.trim().toLowerCase() : "";
  if (!/^[a-z0-9_]{3,30}$/.test(normalized)) return { error: "Username must be 3–30 letters, numbers, or underscores." };
  if (typeof password !== "string" || password.length < 8) return { error: "Password must be at least 8 characters." };
  return { username: normalized, password };
}

export function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  db.insert(authSessions).values({
    id: crypto.randomUUID(), tokenHash: tokenHash(token), userId, createdAt: now, expiresAt: now + SESSION_MS,
  }).run();
  return { token, expiresAt: new Date(now + SESSION_MS) };
}

export function sessionCookie(token: string, expires: Date) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function sessionFromRequest(request: Request): AuthUser | null {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const session = db.select().from(authSessions).where(and(eq(authSessions.tokenHash, tokenHash(token)), gt(authSessions.expiresAt, Date.now()))).get();
  if (!session) return null;
  const user = db.select().from(users).where(eq(users.id, session.userId)).get();
  return user ? toUser(user) : null;
}

export function deleteSessionFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (token) db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash(token))).run();
}

export function findUserByUsername(username: string) {
  return db.select().from(users).where(eq(users.username, username)).get();
}

export function registerUser(username: string, password: string): AuthUser {
  const now = Date.now();
  const id = crypto.randomUUID();
  const displayName = username;
  db.insert(users).values({ id, username, passwordHash: hashPassword(password), displayName, createdAt: now }).run();
  return { id, username, name: displayName, initials: displayName.slice(0, 2).toUpperCase() };
}
