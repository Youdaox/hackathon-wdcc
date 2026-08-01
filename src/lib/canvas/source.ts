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
 * The data contract the GraphQL resolvers talk to.
 *
 * Two implementations exist: `liveSource` (real Canvas REST) and `mockSource`
 * (in-memory fixtures). Resolvers never branch on which one they got, so the
 * demo and a real Canvas account exercise exactly the same code path.
 */
export interface CanvasSource {
  /** "live" | "mock" — surfaced on the `dataSource` query for debugging. */
  readonly kind: "live" | "mock";
  self(): Promise<CanvasUser>;
  courses(opts: { enrollmentState?: string }): Promise<CanvasCourse[]>;
  course(id: string): Promise<CanvasCourse | null>;
  enrollments(courseId: string): Promise<CanvasEnrollment[]>;
  assignments(courseId: string, opts: { bucket?: string }): Promise<CanvasAssignment[]>;
  assignment(courseId: string, id: string): Promise<CanvasAssignment | null>;
  submission(courseId: string, assignmentId: string): Promise<CanvasSubmission | null>;
  modules(courseId: string): Promise<CanvasModule[]>;
  /** Calendar events across the given course context codes, in a date window. */
  calendarEvents(opts: {
    contextCodes: string[];
    startDate?: string;
    endDate?: string;
    type?: "event" | "assignment";
  }): Promise<CanvasCalendarEvent[]>;
}

/** Thrown for anything Canvas rejects; the GraphQL layer maps it to an error. */
export class CanvasApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "CanvasApiError";
  }
}
