import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companions } from "@/lib/db/schema";
import { AVATAR_EMOTIONS, PIG_ACCESSORY_VALUES, PIG_COLOR_VALUES } from "@/lib/types";
import { ensureCompanion } from "@/lib/api/users";
import { requireUserId } from "@/lib/api/identity";
import { levelProgress, moodFor } from "@/lib/companion";

/**
 * The current companion, for clients that don't own one.
 *
 * Not in the original mobile contract, but the phone has to render a pet on
 * launch and the server is authoritative for it — without this the app could
 * only ever show growth it had just caused itself, and would come up blank
 * after a reinstall.
 *
 * `mood` and level progress are derived here rather than shipped as stored
 * columns, for the same reason the web app derives them: two sources for one
 * fact eventually disagree.
 */

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  try {
    // Reading also applies neglect decay, so a phone opened after three idle
    // days shows the same wilted pet the browser would.
    const companion = await ensureCompanion(userId);
    const progress = levelProgress(companion);

    return NextResponse.json({
      name: companion.name,
      species: companion.species,
      color: companion.color,
      accessory: companion.accessory,
      check_in_emotion: companion.checkInEmotion,
      next_check_in_at:
        companion.nextCheckInAt === null ? null : new Date(companion.nextCheckInAt).toISOString(),
      level: companion.level,
      xp: companion.xp,
      xp_needed: progress.needed,
      hp: Math.round(companion.hp),
      mood: moodFor(companion.hp),
      total_focused_ms: companion.totalFocusedMs,
      last_session_at:
        companion.lastSessionAt === null ? null : new Date(companion.lastSessionAt).toISOString(),
    });
  } catch (error) {
    console.error("[companion] failed:", error);
    return NextResponse.json({ error: "failed to load companion" }, { status: 500 });
  }
}

/**
 * Updates the parts of the companion the user owns: coat, accessory, and the
 * emotion from a check-in. Growth is never writable from a client — that
 * stays with POST /api/sessions.
 */
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown> | null;
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const patch: Record<string, unknown> = {};
  if (b?.color !== undefined) {
    if (!PIG_COLOR_VALUES.includes(b.color as never)) {
      return NextResponse.json(
        { error: `color must be one of ${PIG_COLOR_VALUES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.color = b.color;
  }
  if (b?.accessory !== undefined) {
    if (!PIG_ACCESSORY_VALUES.includes(b.accessory as never)) {
      return NextResponse.json(
        { error: `accessory must be one of ${PIG_ACCESSORY_VALUES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.accessory = b.accessory;
  }
  if (b?.check_in_emotion !== undefined) {
    if (b.check_in_emotion !== null && !AVATAR_EMOTIONS.includes(b.check_in_emotion as never)) {
      return NextResponse.json(
        { error: `check_in_emotion must be null or one of ${AVATAR_EMOTIONS.join(", ")}` },
        { status: 400 },
      );
    }
    patch.checkInEmotion = b.check_in_emotion;
    patch.checkInAt = Date.now();
  }
  if (typeof b?.name === "string" && b.name.trim()) {
    patch.name = b.name.trim().slice(0, 24);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  try {
    await ensureCompanion(userId);
    await db.update(companions).set(patch).where(eq(companions.userId, userId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[companion] patch failed:", error);
    return NextResponse.json({ error: "failed to update companion" }, { status: 500 });
  }
}
