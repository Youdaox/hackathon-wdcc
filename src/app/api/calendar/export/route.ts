import { sessionFromRequest } from "@/lib/auth";
import { icsResponse } from "@/lib/calendar-server";

export async function GET(request: Request) {
  const user = await sessionFromRequest(request);
  return user ? await icsResponse(user.id, true) : new Response("Sign in required", { status: 401 });
}
