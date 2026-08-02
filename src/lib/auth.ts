import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { and, eq, gt, sql } from "drizzle-orm";
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
  const trimmed = typeof username === "string" ? username.trim() : "";
  if (!/^[A-Za-z0-9_]{3,30}$/.test(trimmed)) return { error: "Username must be 3–30 letters, numbers, or underscores." };
  if (typeof password !== "string" || password.length < 8) return { error: "Password must be at least 8 characters." };
  return { username: trimmed, password };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await db.insert(authSessions).values({
    id: crypto.randomUUID(), tokenHash: tokenHash(token), userId, createdAt: now, expiresAt: now + SESSION_MS,
  });
  return { token, expiresAt: new Date(now + SESSION_MS) };
}

export function sessionCookie(token: string, expires: Date) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function sessionFromRequest(request: Request): Promise<AuthUser | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const [session] = await db.select().from(authSessions).where(and(eq(authSessions.tokenHash, tokenHash(token)), gt(authSessions.expiresAt, Date.now())));
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user ? toUser(user) : null;
}

export async function deleteSessionFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (token) await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash(token)));
}

export async function findUserByUsername(username: string) {
  const normalized = username.trim();
  const [user] = await db.select().from(users).where(sql`lower(${users.username}) = lower(${normalized})`);
  if (!user) return null;
  if (user.username !== normalized) {
    await db.update(users).set({ username: normalized }).where(eq(users.id, user.id));
    return { ...user, username: normalized };
  }
  return user;
}

export async function registerUser(username: string, password: string): Promise<AuthUser> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const displayName = username;
  const existingUser = await findUserByUsername(username);
  if (existingUser) throw new Error("UNIQUE constraint failed: users.username");
  await db.insert(users).values({ id, username, passwordHash: hashPassword(password), displayName, createdAt: now });
  return { id, username, name: displayName, initials: displayName.slice(0, 2).toUpperCase() };
}
