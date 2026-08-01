import { NextResponse } from "next/server";
import { DomainError } from "./service";

export function identity(request: Request) {
  const userId = request.headers.get("x-user-id")?.trim();
  if (!userId || userId.length > 100) {
    throw new DomainError("UNAUTHENTICATED", "A valid x-user-id header is required.", 401);
  }
  const displayName = request.headers.get("x-user-name")?.trim().slice(0, 80);
  return { userId, displayName };
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
