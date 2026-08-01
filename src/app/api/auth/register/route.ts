import { NextResponse } from "next/server";
import { createSession, registerUser, sessionCookie, validateCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const result = validateCredentials(body?.username, body?.password);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  try {
    const user = registerUser(result.username, result.password);
    const session = createSession(user.id);
    return NextResponse.json({ user }, { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } });
  } catch (error) {
    const isUsernameConflict =
      error instanceof Error && /UNIQUE constraint failed: users\.username/.test(error.message);
    if (isUsernameConflict) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    console.error("registerUser failed", error);
    return NextResponse.json({ error: "Something went wrong creating your account." }, { status: 500 });
  }
}
