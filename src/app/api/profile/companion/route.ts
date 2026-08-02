import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { ensureCompanion } from "@/lib/api/users";
import { db } from "@/lib/db";
import { companions } from "@/lib/db/schema";
import { ANIMAL_SPECIES_VALUES, AVATAR_EMOTIONS, COMPANION_COLOR_VALUES_BY_SPECIES, PIG_ACCESSORY_VALUES } from "@/lib/types";

async function userFor(request: Request) {
  return await sessionFromRequest(request);
}

export async function GET(request: Request) {
  const user = await userFor(request);
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  return NextResponse.json({ companion: await ensureCompanion(user.id) });
}

export async function PUT(request: Request) {
  const user = await userFor(request);
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const species = body && ANIMAL_SPECIES_VALUES.includes(body.species as typeof ANIMAL_SPECIES_VALUES[number])
    ? body.species as typeof ANIMAL_SPECIES_VALUES[number]
    : null;
  if (!body || typeof body.name !== "string" || species === null || !COMPANION_COLOR_VALUES_BY_SPECIES[species].includes(body.color as typeof COMPANION_COLOR_VALUES_BY_SPECIES[typeof species][number]) || !PIG_ACCESSORY_VALUES.includes(body.accessory as typeof PIG_ACCESSORY_VALUES[number])) {
    return NextResponse.json({ error: "Invalid companion profile." }, { status: 400 });
  }
  const emotion = body.checkInEmotion;
  if (emotion !== null && !AVATAR_EMOTIONS.includes(emotion as typeof AVATAR_EMOTIONS[number])) return NextResponse.json({ error: "Invalid companion feeling." }, { status: 400 });
  await ensureCompanion(user.id);
  await db.update(companions).set({
    name: body.name.trim().slice(0, 40) || "Oinky",
    species,
    color: body.color as typeof COMPANION_COLOR_VALUES_BY_SPECIES[typeof species][number],
    accessory: body.accessory as typeof PIG_ACCESSORY_VALUES[number],
    checkInEmotion: emotion as string | null,
    checkInAt: typeof body.checkInAt === "number" ? body.checkInAt : null,
    nextCheckInAt: typeof body.nextCheckInAt === "number" ? body.nextCheckInAt : null,
    lastMeal: body.lastMeal === "breakfast" || body.lastMeal === "lunch" || body.lastMeal === "dinner" ? body.lastMeal : null,
    lastMealAt: typeof body.lastMealAt === "number" ? body.lastMealAt : null,
    lastWaterAt: typeof body.lastWaterAt === "number" ? body.lastWaterAt : null,
    nextWaterCheckAt: typeof body.nextWaterCheckAt === "number" ? body.nextWaterCheckAt : null,
    foodBreakMissed: body.foodBreakMissed === true,
    waterBreakMissed: body.waterBreakMissed === true,
  }).where(eq(companions.userId, user.id));
  return NextResponse.json({ companion: await ensureCompanion(user.id) });
}
