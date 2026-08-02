import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { distractionApps } from "@/lib/db/schema";
import { ensureCompanion } from "@/lib/api/users";
import { uid } from "@/lib/companion";

/**
 * The Android distraction list — package names to watch for with
 * UsageStatsManager.
 *
 * iOS does not use this. There, the user picks apps through Apple's own
 * FamilyActivityPicker and the app only ever holds an opaque
 * FamilyActivitySelection token; the OS never tells us which apps are in it.
 * An iOS client calling this will get a valid list back, but it has nothing
 * to apply it to.
 */

/** Seeded for a new user so the Android app has something to block on day one. */
const DEFAULT_APPS = [
  "com.zhiliaoapp.musically", // TikTok
  "com.instagram.android",
  "com.google.android.youtube",
  "com.discord",
  "com.snapchat.android",
  "com.reddit.frontpage",
  "com.twitter.android",
  "com.facebook.katana",
];

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("user_id");
  if (!userId?.trim()) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  try {
    await ensureCompanion(userId);

    let rows = await db
      .select()
      .from(distractionApps)
      .where(eq(distractionApps.userId, userId))
      ;

    if (rows.length === 0) {
      const now = Date.now();
      await db.transaction(async (tx) => {
        for (const appIdentifier of DEFAULT_APPS) {
          await tx.insert(distractionApps)
            .values({ id: uid(), userId, appIdentifier, createdAt: now })
            ;
        }
      });
      rows = await db
        .select()
        .from(distractionApps)
        .where(eq(distractionApps.userId, userId))
        ;
    }

    return NextResponse.json({ apps: rows.map((row) => row.appIdentifier) });
  } catch (error) {
    console.error("[distraction-list] failed:", error);
    return NextResponse.json({ error: "failed to load distraction list" }, { status: 500 });
  }
}

/**
 * Replaces the user's list wholesale. The Android settings screen edits a
 * local Room copy and pushes the whole set, so the server does not need to
 * reason about individual add/remove operations.
 */
export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const b = body as Record<string, unknown> | null;
  const userId = typeof b?.user_id === "string" ? b.user_id : "";
  if (!userId.trim()) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }
  if (!Array.isArray(b?.apps) || b.apps.some((a) => typeof a !== "string")) {
    return NextResponse.json({ error: "apps must be an array of strings" }, { status: 400 });
  }
  const apps = [...new Set(b.apps as string[])].filter((a) => a.trim().length > 0);

  try {
    await ensureCompanion(userId);
    const now = Date.now();

    await db.transaction(async (tx) => {
      await tx.delete(distractionApps).where(eq(distractionApps.userId, userId));
      for (const appIdentifier of apps) {
        await tx.insert(distractionApps)
          .values({ id: uid(), userId, appIdentifier, createdAt: now })
          ;
      }
    });

    return NextResponse.json({ apps });
  } catch (error) {
    console.error("[distraction-list] failed to replace list:", error);
    return NextResponse.json({ error: "failed to save distraction list" }, { status: 500 });
  }
}
