import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { ensureCompanion } from "@/lib/api/users";
import { db } from "@/lib/db";
import { companions } from "@/lib/db/schema";
import { AVATAR_EMOTIONS, PIG_ACCESSORY_VALUES, PIG_COLOR_VALUES } from "@/lib/types";

function userFor(request: Request) {
  return sessionFromRequest(request);
}

export async function GET(request: Request) {
  const user = userFor(request);
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json({ companion: ensureCompanion(user.id) });
}

export async function PUT(request: Request) {
  const user = userFor(request);
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !PIG_COLOR_VALUES.includes(body.color as typeof PIG_COLOR_VALUES[number]) || !PIG_ACCESSORY_VALUES.includes(body.accessory as typeof PIG_ACCESSORY_VALUES[number])) {
    return NextResponse.json({ error: "Invalid companion profile." }, { status: 400 });
  }
  const emotion = body.checkInEmotion;
  if (emotion !== null && !AVATAR_EMOTIONS.includes(emotion as typeof AVATAR_EMOTIONS[number])) return NextResponse.json({ error: "Invalid companion feeling." }, { status: 400 });
  ensureCompanion(user.id);
  db.update(companions).set({
    name: body.name.trim().slice(0, 40) || "Oinky",
    color: body.color as typeof PIG_COLOR_VALUES[number],
    accessory: body.accessory as typeof PIG_ACCESSORY_VALUES[number],
    checkInEmotion: emotion as string | null,
    checkInAt: typeof body.checkInAt === "number" ? body.checkInAt : null,
    nextCheckInAt: typeof body.nextCheckInAt === "number" ? body.nextCheckInAt : null,
  }).where(eq(companions.userId, user.id)).run();
  return NextResponse.json({ companion: ensureCompanion(user.id) });
}
