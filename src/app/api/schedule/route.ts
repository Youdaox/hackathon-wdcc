import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { studyBlocks } from "@/lib/db/schema";
import { requireUserId } from "@/lib/api/identity";
import { uid } from "@/lib/companion";

/**
 * Weekly study blocks.
 *
 * `days` is stored as a comma-separated string but crosses the wire as an
 * array of 0-6 integers, because that's the `StudyBlock` shape the web model
 * already uses and there is no reason for two representations of a weekday.
 */

interface WireBlock {
  id: string;
  title: string;
  course: string;
  start_min: number;
  end_min: number;
  days: number[];
  source: "manual" | "canvas";
}

function toWire(row: typeof studyBlocks.$inferSelect): WireBlock {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    start_min: row.startMin,
    end_min: row.endMin,
    days: row.days
      .split(",")
      .map((d) => Number(d))
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    source: row.source,
  };
}

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  try {
    const rows = await db.select().from(studyBlocks).where(eq(studyBlocks.userId, userId));
    // Sorted by weekday then start so the client can render without knowing
    // the storage order.
    const blocks = rows
      .map(toWire)
      .sort((a, b) => (a.days[0] ?? 7) - (b.days[0] ?? 7) || a.start_min - b.start_min);
    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("[schedule] failed:", error);
    return NextResponse.json({ error: "failed to load schedule" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim().slice(0, 80) : "";
  const course = typeof b.course === "string" ? b.course.trim().slice(0, 40) : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const startMin = Number(b.start_min);
  const endMin = Number(b.end_min);
  if (!Number.isInteger(startMin) || startMin < 0 || startMin > 1439) {
    return NextResponse.json({ error: "start_min must be 0-1439" }, { status: 400 });
  }
  if (!Number.isInteger(endMin) || endMin <= startMin || endMin > 1440) {
    return NextResponse.json({ error: "end_min must be after start_min" }, { status: 400 });
  }

  const days = Array.isArray(b.days)
    ? [...new Set(b.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    : [];
  if (days.length === 0) {
    return NextResponse.json({ error: "days must contain at least one weekday" }, { status: 400 });
  }

  try {
    const id = uid();
    await db.insert(studyBlocks).values({
      id,
      userId,
      title,
      course,
      startMin,
      endMin,
      days: days.sort().join(","),
      source: "manual",
      createdAt: Date.now(),
    });
    return NextResponse.json({ id });
  } catch (error) {
    console.error("[schedule] failed to create:", error);
    return NextResponse.json({ error: "failed to create block" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    // Scoped to the caller so an id from another account can't be deleted.
    await db.delete(studyBlocks).where(and(eq(studyBlocks.id, id), eq(studyBlocks.userId, userId)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[schedule] failed to delete:", error);
    return NextResponse.json({ error: "failed to delete block" }, { status: 500 });
  }
}
