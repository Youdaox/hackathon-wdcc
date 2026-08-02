import { NextResponse } from "next/server";
import { createSession, findUserByUsername, validateCredentials, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const result = validateCredentials(body?.username, body?.password);
  if ("error" in result) return NextResponse.json({ error: "Invalid username or password." }, { status: 400 });
  const user = await findUserByUsername(result.username);
  if (!user || !verifyPassword(result.password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  const session = await createSession(user.id);
  const response = NextResponse.json({ user: { id: user.id, username: user.username, name: user.displayName, initials: user.displayName.slice(0, 2).toUpperCase() } });
  response.cookies.set({ name: "incline_session", value: session.token, path: "/", httpOnly: true, sameSite: "lax", expires: session.expiresAt, secure: process.env.NODE_ENV === "production" });
  return response;
}
