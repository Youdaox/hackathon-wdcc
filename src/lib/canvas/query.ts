/**
 * Browser-side access to the Canvas GraphQL endpoint.
 *
 * No GraphQL client library: the app makes three queries total, and a `fetch`
 * wrapper is smaller than the cache layer a client would bring. Credentials
 * ride along in the httpOnly login cookie, so nothing here touches a token.
 */

export interface CanvasStudyBlock {
  externalId: string;
  title: string;
  course: string;
  startMin: number;
  endMin: number;
  days: number[];
}

export interface CanvasCourseSummary {
  id: string;
  courseCode: string;
  name: string;
}

export interface CanvasUpcomingAssignment {
  id: string;
  name: string;
  courseId: string;
  dueAt: string | null;
  pointsPossible: number | null;
  htmlUrl: string;
}

export interface CanvasOverview {
  dataSource: "live" | "mock";
  courses: CanvasCourseSummary[];
  studyBlocks: CanvasStudyBlock[];
  assignments: CanvasUpcomingAssignment[];
}

const OVERVIEW_QUERY = /* GraphQL */ `
  query Overview {
    dataSource
    courses {
      id
      courseCode
      name
    }
    studyBlocks {
      externalId
      title
      course
      startMin
      endMin
      days
    }
    assignments(bucket: UPCOMING, limit: 5) {
      id
      name
      courseId
      dueAt
      pointsPossible
      htmlUrl
    }
  }
`;

/** Thrown with a message already fit to show the user. */
export class CanvasQueryError extends Error {}

async function graphql<T>(query: string): Promise<T> {
  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // The login cookie is httpOnly; this is what attaches it.
    credentials: "same-origin",
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new CanvasQueryError(`Canvas request failed (${response.status}).`);
  }

  const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (payload.errors?.length) {
    throw new CanvasQueryError(payload.errors[0].message);
  }
  if (!payload.data) {
    throw new CanvasQueryError("Canvas returned no data.");
  }
  return payload.data;
}

/**
 * One round trip for everything the Canvas card shows — timetable, courses, and
 * upcoming work. Doing it as a single query is the whole point of the GraphQL
 * layer; against Canvas' REST API this would be four requests plus a fan-out.
 */
export function fetchOverview(): Promise<CanvasOverview> {
  return graphql<CanvasOverview>(OVERVIEW_QUERY);
}
