import { GraphQLError } from "graphql";
import { createYoga } from "graphql-yoga";
import { configFromEnv, liveSource } from "@/lib/canvas/client";
import { mockSource } from "@/lib/canvas/mock";
import { schema, type Context } from "@/lib/canvas/schema";
import { readSession } from "@/lib/canvas/session";
import { CanvasApiError } from "@/lib/canvas/source";

/**
 * GraphQL endpoint for Canvas LMS data — `POST /api/graphql`, with GraphiQL
 * served on `GET /api/graphql` in development.
 *
 * Credentials resolve per request, most specific first:
 *   1. `X-Canvas-Token` (+ optional `X-Canvas-Base-Url`) headers — for scripts
 *      and other non-browser callers.
 *   2. The httpOnly login cookie set by `/api/canvas/session` — the browser UI.
 *   3. `CANVAS_BASE_URL` + `CANVAS_ACCESS_TOKEN` env vars — a single account.
 *   4. None of the above — in-memory fixtures, so the demo runs with no Canvas.
 *
 * Tokens are used for the life of one request; none reaches client JavaScript.
 */

async function buildContext({ request }: { request: Request }): Promise<Context> {
  const headerToken = request.headers.get("x-canvas-token");
  const headerBaseUrl = request.headers.get("x-canvas-base-url");

  if (headerToken) {
    const baseUrl = headerBaseUrl ?? process.env.CANVAS_BASE_URL;
    // A token with no instance to point it at is a client mistake, not a
    // reason to silently serve someone else's data from the env credentials.
    if (!baseUrl) {
      throw new CanvasApiError(
        "X-Canvas-Token was sent without X-Canvas-Base-Url, and CANVAS_BASE_URL is unset.",
        400,
        "/api/graphql",
      );
    }
    return { canvas: liveSource({ baseUrl, token: headerToken }) };
  }

  const session = await readSession();
  if (session) return { canvas: liveSource(session) };

  const envConfig = configFromEnv();
  return { canvas: envConfig ? liveSource(envConfig) : mockSource() };
}

const yoga = createYoga<object, Context>({
  schema,
  context: buildContext,
  // Next owns the routing; Yoga only needs to know where it is mounted.
  graphqlEndpoint: "/api/graphql",
  graphiql: process.env.NODE_ENV !== "production",
  fetchAPI: { Response },
  maskedErrors: {
    // Canvas failures (401 bad token, 403 no access, 404) are actionable by the
    // caller, so pass those through; anything else is masked as usual.
    maskError(error, message) {
      const original = error instanceof Error && "originalError" in error ? error.originalError : error;
      if (original instanceof CanvasApiError) {
        return new GraphQLError(`Canvas API error on ${original.path}: ${original.message}`, {
          extensions: { code: "CANVAS_API_ERROR", status: original.status },
        });
      }
      console.error("[graphql]", error);
      return new GraphQLError(message);
    },
  },
});

export async function GET(request: Request) {
  return yoga.handleRequest(request, {});
}

export async function POST(request: Request) {
  return yoga.handleRequest(request, {});
}

export async function OPTIONS(request: Request) {
  return yoga.handleRequest(request, {});
}
