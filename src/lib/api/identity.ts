import { sessionFromRequest } from "@/lib/auth";

/**
 * Who a mobile request is for.
 *
 * The session cookie is the only trusted source. The `user_id` query parameter
 * these routes used to take was fine when mobile had no accounts, but it now
 * means "act as anyone you can name" — and it can't work anyway, since
 * companions are foreign-keyed to real user rows.
 *
 * Resolving from the session is also what makes the phone and the desktop app
 * share one companion: both present the same cookie, so both land on the same
 * row.
 */
export async function requireUserId(request: Request): Promise<string | null> {
  const user = await sessionFromRequest(request);
  return user?.id ?? null;
}
