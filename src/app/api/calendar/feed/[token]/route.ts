import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarFeedTokens } from "@/lib/db/schema";
import { icsResponse } from "@/lib/calendar-server";

export async function GET(_request: Request, context: RouteContext<"/api/calendar/feed/[token]">) {
  const { token } = await context.params;
  const [feed] = await db.select().from(calendarFeedTokens).where(eq(calendarFeedTokens.token, token));
  return feed ? await icsResponse(feed.userId) : new Response("Calendar feed not found", { status: 404 });
}
