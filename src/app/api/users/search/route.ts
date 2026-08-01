import { asc, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function GET(request: Request) {
  const currentUser = sessionFromRequest(request);
  if (!currentUser) return NextResponse.json({ error: "Please log in to search users." }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (query.length < 2) return NextResponse.json({ users: [] });
  const matches = db.select({ id: users.id, username: users.username, name: users.displayName })
    .from(users)
    .where(or(like(users.username, `%${query}%`), like(users.displayName, `%${query}%`)))
    .orderBy(asc(users.username))
    .limit(12)
    .all()
    .filter((user) => user.id !== currentUser.id);
  return NextResponse.json({ users: matches.map((user) => ({ ...user, initials: user.name.slice(0, 2).toUpperCase() })) });
}
