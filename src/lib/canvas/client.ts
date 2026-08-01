import { CanvasApiError, type CanvasSource } from "./source";
import type {
  CanvasAssignment,
  CanvasCalendarEvent,
  CanvasCourse,
  CanvasEnrollment,
  CanvasModule,
  CanvasSubmission,
  CanvasUser,
} from "./types";

/**
 * Live Canvas LMS REST client.
 *
 * Canvas pages every list endpoint and advertises the next page in an RFC 5988
 * `Link` header rather than in the body, so `paged()` walks that chain instead
 * of trusting a page count. A hard cap stops a misbehaving instance from
 * looping forever.
 *
 * The access token stays server-side: this module is only ever imported by the
 * route handler, never by a client component.
 */

const MAX_PAGES = 20;
const PER_PAGE = 100;

interface ClientConfig {
  /** Instance root, e.g. "https://canvas.auckland.ac.nz". No trailing slash. */
  baseUrl: string;
  /** Canvas personal access token. */
  token: string;
}

/** Pulls the `rel="next"` URL out of a Canvas `Link` header, if there is one. */
function nextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

function createClient({ baseUrl, token }: ClientConfig) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<{ data: T; link: string | null }> {
    const url = path.startsWith("http") ? new URL(path) : new URL(`${root}/api/v1${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined || value === null) continue;
      // Canvas takes repeated `key[]=` params for arrays.
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(`${key}[]`, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      // Course lists and due dates change during a session; never serve stale.
      cache: "no-store",
    });

    if (!response.ok) {
      throw new CanvasApiError(
        `Canvas responded ${response.status} ${response.statusText}`,
        response.status,
        url.pathname,
      );
    }

    return { data: (await response.json()) as T, link: response.headers.get("link") };
  }

  /** Single object fetch. */
  async function one<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const { data } = await request<T>(path, params);
    return data;
  }

  /** List fetch that follows `Link: rel="next"` until Canvas runs out of pages. */
  async function paged<T>(path: string, params?: Record<string, unknown>): Promise<T[]> {
    const out: T[] = [];
    let next: string | null = null;
    let page = 0;

    do {
      const result = await request<T[]>(
        next ?? path,
        next ? undefined : { ...params, per_page: PER_PAGE },
      );
      out.push(...(Array.isArray(result.data) ? result.data : []));
      next = nextPageUrl(result.link);
      page += 1;
    } while (next && page < MAX_PAGES);

    return out;
  }

  return { one, paged };
}

export function liveSource(config: ClientConfig): CanvasSource {
  const api = createClient(config);

  return {
    kind: "live",

    self: () => api.one<CanvasUser>("/users/self/profile"),

    courses: ({ enrollmentState = "active" }) =>
      api.paged<CanvasCourse>("/courses", {
        enrollment_state: enrollmentState,
        include: ["term", "total_scores"],
      }),

    course: async (id) => {
      try {
        return await api.one<CanvasCourse>(`/courses/${id}`, { include: ["term", "total_scores"] });
      } catch (error) {
        // A course the user isn't in reads as "not found" to them, not an error.
        if (error instanceof CanvasApiError && (error.status === 404 || error.status === 403)) return null;
        throw error;
      }
    },

    enrollments: (courseId) => api.paged<CanvasEnrollment>(`/courses/${courseId}/enrollments`),

    assignments: (courseId, { bucket }) =>
      api.paged<CanvasAssignment>(`/courses/${courseId}/assignments`, {
        bucket,
        include: ["submission"],
        order_by: "due_at",
      }),

    assignment: async (courseId, id) => {
      try {
        return await api.one<CanvasAssignment>(`/courses/${courseId}/assignments/${id}`, {
          include: ["submission"],
        });
      } catch (error) {
        if (error instanceof CanvasApiError && error.status === 404) return null;
        throw error;
      }
    },

    submission: async (courseId, assignmentId) => {
      try {
        return await api.one<CanvasSubmission>(
          `/courses/${courseId}/assignments/${assignmentId}/submissions/self`,
        );
      } catch (error) {
        // No submission yet is the common case, not a failure.
        if (error instanceof CanvasApiError && error.status === 404) return null;
        throw error;
      }
    },

    modules: (courseId) => api.paged<CanvasModule>(`/courses/${courseId}/modules`, { include: ["items"] }),

    calendarEvents: ({ contextCodes, startDate, endDate, type = "event" }) =>
      api.paged<CanvasCalendarEvent>("/calendar_events", {
        context_codes: contextCodes,
        start_date: startDate,
        end_date: endDate,
        type,
      }),
  };
}

/** Reads Canvas credentials from the environment. Returns null when unset. */
export function configFromEnv(): ClientConfig | null {
  const baseUrl = process.env.CANVAS_BASE_URL;
  const token = process.env.CANVAS_ACCESS_TOKEN;
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}
