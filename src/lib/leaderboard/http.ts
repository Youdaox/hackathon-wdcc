import { NextResponse } from "next/server";
import { DomainError } from "./service";
import { sessionFromRequest } from "@/lib/auth";

export async function identity(request: Request) {
  const user = await sessionFromRequest(request);
  if (user) return { userId: user.id, displayName: user.name };
  // Community is already login-gated in the client. This fallback keeps its
  // actions usable if an Electron/browser cookie is unavailable.
  const userId = request.headers.get("x-user-id")?.trim();
  if (userId) return { userId, displayName: request.headers.get("x-user-name")?.trim() || userId };
  throw new DomainError("UNAUTHENTICATED", "Select an account to continue.", 401);
}

export function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error("[leaderboard] unexpected error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}

export async function jsonObject(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new DomainError("INVALID_CONTENT_TYPE", "Content-Type must be application/json.", 415);
  }
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new DomainError("INVALID_JSON", "Request body must be a JSON object.");
  }
}
