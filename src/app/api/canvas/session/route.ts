import { NextResponse } from "next/server";
import { configFromEnv, liveSource } from "@/lib/canvas/client";
import { CanvasApiError } from "@/lib/canvas/source";
import { clearSession, normaliseBaseUrl, readSession, writeSession } from "@/lib/canvas/session";

/**
 * Canvas login.
 *
 *   GET    — who, if anyone, is connected
 *   POST   — verify a token against the instance, then store it httpOnly
 *   DELETE — disconnect
 *
 * The token is verified before it is stored, so a typo surfaces as "that token
 * was rejected" on the login form rather than as a broken dashboard later.
 */

export interface CanvasSessionStatus {
  connected: boolean;
  /** Where the credentials came from: the login form, env vars, or nothing. */
  origin: "session" | "env" | "none";
  user?: { name: string; email: string | null };
  baseUrl?: string;
}

export async function GET() {
  const session = await readSession();

  if (session) {
    try {
      const user = await liveSource(session).self();
      return NextResponse.json<CanvasSessionStatus>({
        connected: true,
        origin: "session",
        user: { name: user.name, email: user.primary_email ?? null },
        baseUrl: session.baseUrl,
      });
    } catch {
      // Token revoked or expired since login — drop it so the UI offers the
      // form again instead of failing every query from here on.
      await clearSession();
    }
  }

  const env = configFromEnv();
  return NextResponse.json<CanvasSessionStatus>(
    env
      ? { connected: true, origin: "env", baseUrl: env.baseUrl }
      : { connected: false, origin: "none" },
  );
}

export async function POST(request: Request) {
  let baseUrlInput = "";
  let token = "";
  try {
    const body = await request.json();
    baseUrlInput = typeof body?.baseUrl === "string" ? body.baseUrl : "";
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const baseUrl = normaliseBaseUrl(baseUrlInput);
  if (!baseUrl) {
    return NextResponse.json(
      { error: "That doesn't look like a Canvas URL. Try canvas.auckland.ac.nz" },
      { status: 400 },
    );
  }
  if (!token) {
    return NextResponse.json({ error: "Paste your Canvas access token." }, { status: 400 });
  }

  try {
    const user = await liveSource({ baseUrl, token }).self();
    await writeSession({ baseUrl, token });
    return NextResponse.json<CanvasSessionStatus>({
      connected: true,
      origin: "session",
      user: { name: user.name, email: user.primary_email ?? null },
      baseUrl,
    });
  } catch (error) {
    if (error instanceof CanvasApiError) {
      const message =
        error.status === 401
          ? "Canvas rejected that token. Generate a fresh one and try again."
          : error.status === 404
            ? "Reached that host, but it isn't a Canvas instance."
            : `Canvas responded ${error.status}.`;
      return NextResponse.json({ error: message }, { status: 400 });
    }
    // DNS failure, wrong host, offline — all read the same to the user.
    return NextResponse.json(
      { error: "Couldn't reach that Canvas instance. Check the URL and your connection." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json<CanvasSessionStatus>({ connected: false, origin: "none" });
}
