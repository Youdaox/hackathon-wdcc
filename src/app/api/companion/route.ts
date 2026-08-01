import { NextResponse } from "next/server";
import { ensureCompanion } from "@/lib/api/users";
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
  const userId = new URL(request.url).searchParams.get("user_id");
  if (!userId?.trim()) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    // Reading also applies neglect decay, so a phone opened after three idle
    // days shows the same wilted pet the browser would.
    const companion = ensureCompanion(userId);
    const progress = levelProgress(companion);

    return NextResponse.json({
      name: companion.name,
      species: companion.species,
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
