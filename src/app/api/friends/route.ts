import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { friendships, users } from "@/lib/db/schema";

function current(request: Request) {
  const user = sessionFromRequest(request);
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function GET(request: Request) {
  try {
    const user = current(request);
    const rows = db.select().from(friendships).where(eq(friendships.userId, user.id)).all();
    const ids = rows.map((row) => row.friendId);
    if (!ids.length) return NextResponse.json({ friends: [] });
    const friends = db.select({ id: users.id, username: users.username, name: users.displayName }).from(users).where(inArray(users.id, ids)).all();
    return NextResponse.json({ friends: friends.map((friend) => ({ ...friend, initials: friend.name.slice(0, 2).toUpperCase() })) });
  } catch { return NextResponse.json({ error: "Please log in to view friends." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    const user = current(request);
    const body = await request.json().catch(() => null) as { userId?: unknown } | null;
    const friendId = typeof body?.userId === "string" ? body.userId : "";
    if (!friendId || friendId === user.id) return NextResponse.json({ error: "Choose another user." }, { status: 400 });
    if (!db.select({ id: users.id }).from(users).where(eq(users.id, friendId)).get()) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const now = Date.now();
    db.transaction((tx) => {
      tx.insert(friendships).values({ id: crypto.randomUUID(), userId: user.id, friendId, createdAt: now }).onConflictDoNothing().run();
      tx.insert(friendships).values({ id: crypto.randomUUID(), userId: friendId, friendId: user.id, createdAt: now }).onConflictDoNothing().run();
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch { return NextResponse.json({ error: "Please log in to add friends." }, { status: 401 }); }
}
