import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";
import { sessionFromRequest } from "@/lib/auth";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/calendar";

function eventJson(row: typeof calendarEvents.$inferSelect) {
  return { id: row.id, title: row.title, date: row.eventDate, startTime: row.startTime, endTime: row.endTime, category: row.category as EventCategory, description: row.description, location: row.location ?? "" };
}

function validated(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const text = (key: string) => typeof item[key] === "string" ? item[key] as string : "";
  const category = text("category");
  const result = { title: text("title").trim(), eventDate: text("date"), startTime: text("startTime"), endTime: text("endTime"), category, description: text("description").trim(), location: text("location").trim() || null };
  if (!result.title || !EVENT_CATEGORIES.includes(category as EventCategory) || !/^\d{4}-\d{2}-\d{2}$/.test(result.eventDate) || !/^\d{2}:\d{2}$/.test(result.startTime) || !/^\d{2}:\d{2}$/.test(result.endTime) || result.endTime <= result.startTime) return null;
  return { ...result, category: category as EventCategory };
}

export async function GET(request: Request) {
  const user = await sessionFromRequest(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json(
    { events: (await db.select().from(calendarEvents).where(eq(calendarEvents.userId, user.id)).orderBy(asc(calendarEvents.eventDate), asc(calendarEvents.startTime))).map(eventJson) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const user = await sessionFromRequest(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const items = Array.isArray(body) ? body : [body];
  const drafts = items.map(validated);
  if (!drafts.length || drafts.some((item) => !item)) return Response.json({ error: "Check the event details and time range." }, { status: 400 });
  const now = Date.now();
  const rows = drafts.map((draft) => ({ ...draft!, id: crypto.randomUUID(), userId: user.id, createdAt: now, updatedAt: now }));
  await db.insert(calendarEvents).values(rows);
  return Response.json({ events: rows.map(eventJson) }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await sessionFromRequest(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const draft = validated(body);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id || !draft) return Response.json({ error: "Check the event details and time range." }, { status: 400 });
  await db.update(calendarEvents).set({ ...draft, updatedAt: Date.now() }).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, user.id)));
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await sessionFromRequest(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await db.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, user.id)));
  return Response.json({ ok: true });
}
