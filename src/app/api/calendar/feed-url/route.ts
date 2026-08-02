import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarFeedTokens } from "@/lib/db/schema";
import { sessionFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await sessionFromRequest(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  let [row] = await db.select().from(calendarFeedTokens).where(eq(calendarFeedTokens.userId, user.id));
  if (!row) {
    row = { userId: user.id, token: randomBytes(24).toString("base64url"), createdAt: Date.now() };
    await db.insert(calendarFeedTokens).values(row);
  }
  return Response.json({ url: `${new URL(request.url).origin}/api/calendar/feed/${row.token}` });
}
