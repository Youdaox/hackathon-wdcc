import { NextResponse } from "next/server";
import { createSession, registerUser, validateCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const result = validateCredentials(body?.username, body?.password);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  try {
    const user = await registerUser(result.username, result.password);
    const session = await createSession(user.id);
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set({ name: "incline_session", value: session.token, path: "/", httpOnly: true, sameSite: "lax", expires: session.expiresAt, secure: process.env.NODE_ENV === "production" });
    return response;
  } catch (error) {
    const isUsernameConflict =
      error instanceof Error && /(unique|duplicate)/i.test(error.message);
    if (isUsernameConflict) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    console.error("registerUser failed", error);
    return NextResponse.json({ error: "Something went wrong creating your account." }, { status: 500 });
  }
}
