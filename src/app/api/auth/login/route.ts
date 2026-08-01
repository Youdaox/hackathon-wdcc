import { NextResponse } from "next/server";
import { createSession, findUserByUsername, sessionCookie, validateCredentials, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const result = validateCredentials(body?.username, body?.password);
  if ("error" in result) return NextResponse.json({ error: "Invalid username or password." }, { status: 400 });
  const user = findUserByUsername(result.username);
  if (!user || !verifyPassword(result.password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  const session = createSession(user.id);
  return NextResponse.json({ user: { id: user.id, username: user.username, name: user.displayName, initials: user.displayName.slice(0, 2).toUpperCase() } }, { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } });
}
