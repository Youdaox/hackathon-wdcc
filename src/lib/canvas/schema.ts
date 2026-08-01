import { GraphQLError, GraphQLScalarType, Kind } from "graphql";
import { createSchema } from "graphql-yoga";
import { eventsToStudyBlocks } from "./schedule";
import type { CanvasSource } from "./source";
import type {
  CanvasAssignment,
  CanvasCalendarEvent,
  CanvasCourse,
  CanvasEnrollment,
  CanvasModule,
} from "./types";

/**
 * GraphQL surface over the Canvas LMS API.
 *
 * Canvas' own REST API forces a request per course per resource — three
 * courses' assignments is four round trips from the browser. This schema lets
 * the client ask for the whole shape in one query and does the fan-out here,
 * server-side, where the access token lives.
 *
 * Types are camelCased and dates are ISO-8601 strings (Canvas' own format), so
 * `new Date(assignment.dueAt)` works client-side with no parsing layer.
 */

export interface Context {
  canvas: CanvasSource;
}

const typeDefs = /* GraphQL */ `
  """
  An ISO-8601 timestamp, e.g. "2026-08-01T09:00:00Z". Serialised as a String.
  """
  scalar DateTime

  type Query {
    """Which backend is answering — 'live' when Canvas credentials are configured, else 'mock'."""
    dataSource: String!

    """The authenticated Canvas user."""
    self: User!

    """Courses the user is enrolled in."""
    courses(enrollmentState: EnrollmentState = ACTIVE): [Course!]!

    """A single course by Canvas id. Null when it doesn't exist or isn't visible."""
    course(id: ID!): Course

    """
    Assignments across every active course, newest due date last.
    Saves the client a request per course.
    """
    assignments(bucket: AssignmentBucket, limit: Int = 50): [Assignment!]!

    """Calendar events across every active course in a date window."""
    calendarEvents(startDate: DateTime, endDate: DateTime, courseIds: [ID!]): [CalendarEvent!]!

    """
    This week's Canvas timetable, already collapsed into Incline's recurring
    study-block shape — the import path for the schedule table.
    """
    studyBlocks(startDate: DateTime, endDate: DateTime): [StudyBlock!]!
  }

  enum EnrollmentState {
    ACTIVE
    INVITED
    COMPLETED
  }

  enum AssignmentBucket {
    UPCOMING
    PAST
    UNSUBMITTED
  }

  enum EnrollmentType {
    STUDENT
    TEACHER
    TA
    OBSERVER
    DESIGNER
  }

  type User {
    id: ID!
    name: String!
    shortName: String
    sortableName: String
    avatarUrl: String
    email: String
    timeZone: String
  }

  type Course {
    id: ID!
    """Full title, e.g. "Software Design Methodology"."""
    name: String!
    """Short code, e.g. "COMPSCI 235". This is what a StudyBlock stores."""
    courseCode: String!
    workflowState: String!
    startAt: DateTime
    endAt: DateTime
    termName: String
    enrollments: [Enrollment!]!
    assignments(bucket: AssignmentBucket): [Assignment!]!
    modules: [Module!]!
    calendarEvents(startDate: DateTime, endDate: DateTime): [CalendarEvent!]!
  }

  type Enrollment {
    id: ID!
    courseId: ID!
    userId: ID!
    type: EnrollmentType!
    state: String!
    """Percentage 0–100 for work graded so far. Null when grades are hidden."""
    currentScore: Float
    """Percentage 0–100 treating ungraded work as zero."""
    finalScore: Float
    currentGrade: String
    finalGrade: String
  }

  type Assignment {
    id: ID!
    courseId: ID!
    name: String!
    """Canvas returns HTML here, not plain text."""
    description: String
    dueAt: DateTime
    unlockAt: DateTime
    lockAt: DateTime
    pointsPossible: Float
    htmlUrl: String!
    submissionTypes: [String!]!
    published: Boolean!
    """The authenticated user's submission, if any."""
    submission: Submission
    """Convenience flag: due in the future and not yet submitted."""
    isOutstanding: Boolean!
  }

  type Submission {
    id: ID!
    assignmentId: ID!
    submittedAt: DateTime
    gradedAt: DateTime
    score: Float
    grade: String
    late: Boolean!
    missing: Boolean!
    excused: Boolean
    workflowState: String!
    attempt: Int
  }

  type CalendarEvent {
    id: ID!
    title: String!
    description: String
    startAt: DateTime
    endAt: DateTime
    locationName: String
    """Canvas context code, e.g. "course_101"."""
    contextCode: String!
    contextName: String
    htmlUrl: String!
  }

  type Module {
    id: ID!
    courseId: ID!
    name: String!
    position: Int!
    state: String
    unlockAt: DateTime
    items: [ModuleItem!]!
  }

  type ModuleItem {
    id: ID!
    title: String!
    type: String!
    htmlUrl: String
    completed: Boolean
  }

  """A recurring block ready to drop into Incline's schedule table."""
  type StudyBlock {
    """Canvas event id of the first occurrence — the import's dedup key."""
    externalId: ID!
    title: String!
    course: String!
    """Minutes from midnight, 0–1439."""
    startMin: Int!
    endMin: Int!
    """Weekdays this repeats on. 0 = Sunday … 6 = Saturday."""
    days: [Int!]!
    """Always "canvas" — matches StudyBlock.source on the client."""
    source: String!
  }
`;

const ENROLLMENT_STATE: Record<string, string> = {
  ACTIVE: "active",
  INVITED: "invited",
  COMPLETED: "completed",
};

const BUCKET: Record<string, string> = {
  UPCOMING: "upcoming",
  PAST: "past",
  UNSUBMITTED: "unsubmitted",
};

const ENROLLMENT_TYPE: Record<string, string> = {
  StudentEnrollment: "STUDENT",
  TeacherEnrollment: "TEACHER",
  TaEnrollment: "TA",
  ObserverEnrollment: "OBSERVER",
  DesignerEnrollment: "DESIGNER",
};

/** Default calendar window: the current week, Monday to Sunday. */
function defaultWeek(): { startDate: string; endDate: string } {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);
  return { startDate: monday.toISOString(), endDate: sunday.toISOString() };
}

/** Fetches calendar events for a set of courses, defaulting to this week. */
async function eventsForCourses(
  canvas: CanvasSource,
  courseIds: string[],
  startDate?: string | null,
  endDate?: string | null,
): Promise<CanvasCalendarEvent[]> {
  if (courseIds.length === 0) return [];
  const week = defaultWeek();
  return canvas.calendarEvents({
    contextCodes: courseIds.map((id) => `course_${id}`),
    startDate: startDate ?? week.startDate,
    endDate: endDate ?? week.endDate,
  });
}

function throwBadDate(): never {
  throw new GraphQLError("DateTime must be an ISO-8601 string, e.g. 2026-08-01T09:00:00Z");
}

/** Accepts any string Date can parse, and hands back a normalised ISO string. */
function parseIso(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throwBadDate();
  return new Date(value as string).toISOString();
}

function dueTime(assignment: CanvasAssignment): number {
  return assignment.due_at ? Date.parse(assignment.due_at) : Number.POSITIVE_INFINITY;
}

export const schema = createSchema<Context>({
  typeDefs,
  resolvers: {
    // Canvas already speaks ISO-8601, so DateTime is a pass-through String with
    // a name that documents the format. Validation happens on the way in.
    DateTime: new GraphQLScalarType<string, string>({
      name: "DateTime",
      description: "An ISO-8601 timestamp.",
      serialize: (value) => String(value),
      parseValue: (value) => parseIso(value),
      parseLiteral: (node) =>
        node.kind === Kind.STRING ? parseIso(node.value) : throwBadDate(),
    }),

    Query: {
      dataSource: (_parent, _args, { canvas }) => canvas.kind,

      self: (_parent, _args, { canvas }) => canvas.self(),

      courses: (_parent, { enrollmentState }: { enrollmentState?: string }, { canvas }) =>
        canvas.courses({ enrollmentState: ENROLLMENT_STATE[enrollmentState ?? "ACTIVE"] }),

      course: (_parent, { id }: { id: string }, { canvas }) => canvas.course(id),

      assignments: async (
        _parent,
        { bucket, limit }: { bucket?: string; limit?: number },
        { canvas },
      ) => {
        const courses = await canvas.courses({ enrollmentState: "active" });
        // One Canvas request per course, in parallel — the fan-out this API exists to hide.
        const perCourse = await Promise.all(
          courses.map((course) =>
            canvas.assignments(course.id, { bucket: bucket ? BUCKET[bucket] : undefined }),
          ),
        );
        return perCourse
          .flat()
          .sort((a, b) => dueTime(a) - dueTime(b))
          .slice(0, Math.max(0, limit ?? 50));
      },

      calendarEvents: async (
        _parent,
        args: { startDate?: string; endDate?: string; courseIds?: string[] },
        { canvas },
      ) => {
        const ids =
          args.courseIds ??
          (await canvas.courses({ enrollmentState: "active" })).map((course) => course.id);
        return eventsForCourses(canvas, ids, args.startDate, args.endDate);
      },

      studyBlocks: async (
        _parent,
        args: { startDate?: string; endDate?: string },
        { canvas },
      ) => {
        const courses = await canvas.courses({ enrollmentState: "active" });
        const events = await eventsForCourses(
          canvas,
          courses.map((course) => course.id),
          args.startDate,
          args.endDate,
        );
        return eventsToStudyBlocks(events);
      },
    },

    Course: {
      courseCode: (course: CanvasCourse) => course.course_code,
      workflowState: (course: CanvasCourse) => course.workflow_state,
      startAt: (course: CanvasCourse) => course.start_at ?? null,
      endAt: (course: CanvasCourse) => course.end_at ?? null,
      termName: (course: CanvasCourse) => course.term?.name ?? null,

      // Canvas embeds enrollments on the course when asked; only spend a
      // request when it didn't.
      enrollments: (course: CanvasCourse, _args, { canvas }: Context) =>
        course.enrollments ?? canvas.enrollments(course.id),

      assignments: (course: CanvasCourse, { bucket }: { bucket?: string }, { canvas }: Context) =>
        canvas.assignments(course.id, { bucket: bucket ? BUCKET[bucket] : undefined }),

      modules: (course: CanvasCourse, _args, { canvas }: Context) => canvas.modules(course.id),

      calendarEvents: (
        course: CanvasCourse,
        args: { startDate?: string; endDate?: string },
        { canvas }: Context,
      ) => eventsForCourses(canvas, [course.id], args.startDate, args.endDate),
    },

    Enrollment: {
      courseId: (enrollment: CanvasEnrollment) => enrollment.course_id,
      userId: (enrollment: CanvasEnrollment) => enrollment.user_id,
      type: (enrollment: CanvasEnrollment) => ENROLLMENT_TYPE[enrollment.type] ?? "STUDENT",
      state: (enrollment: CanvasEnrollment) => enrollment.enrollment_state,
      currentScore: (enrollment: CanvasEnrollment) => enrollment.grades?.current_score ?? null,
      finalScore: (enrollment: CanvasEnrollment) => enrollment.grades?.final_score ?? null,
      currentGrade: (enrollment: CanvasEnrollment) => enrollment.grades?.current_grade ?? null,
      finalGrade: (enrollment: CanvasEnrollment) => enrollment.grades?.final_grade ?? null,
    },

    Assignment: {
      courseId: (assignment: CanvasAssignment) => assignment.course_id,
      dueAt: (assignment: CanvasAssignment) => assignment.due_at ?? null,
      unlockAt: (assignment: CanvasAssignment) => assignment.unlock_at ?? null,
      lockAt: (assignment: CanvasAssignment) => assignment.lock_at ?? null,
      pointsPossible: (assignment: CanvasAssignment) => assignment.points_possible ?? null,
      htmlUrl: (assignment: CanvasAssignment) => assignment.html_url,
      submissionTypes: (assignment: CanvasAssignment) => assignment.submission_types ?? [],

      submission: (assignment: CanvasAssignment, _args, { canvas }: Context) =>
        assignment.submission !== undefined
          ? assignment.submission
          : canvas.submission(assignment.course_id, assignment.id),

      isOutstanding: async (assignment: CanvasAssignment, _args, { canvas }: Context) => {
        const due = assignment.due_at ? Date.parse(assignment.due_at) : null;
        if (due === null || due < Date.now()) return false;
        const submission =
          assignment.submission !== undefined
            ? assignment.submission
            : await canvas.submission(assignment.course_id, assignment.id);
        return !submission?.submitted_at;
      },
    },

    Submission: {
      assignmentId: (submission) => submission.assignment_id,
      submittedAt: (submission) => submission.submitted_at ?? null,
      gradedAt: (submission) => submission.graded_at ?? null,
      workflowState: (submission) => submission.workflow_state,
    },

    CalendarEvent: {
      startAt: (event: CanvasCalendarEvent) => event.start_at ?? null,
      endAt: (event: CanvasCalendarEvent) => event.end_at ?? null,
      locationName: (event: CanvasCalendarEvent) => event.location_name ?? null,
      contextCode: (event: CanvasCalendarEvent) => event.context_code,
      contextName: (event: CanvasCalendarEvent) => event.context_name ?? null,
      htmlUrl: (event: CanvasCalendarEvent) => event.html_url,
    },

    Module: {
      courseId: (module: CanvasModule) => module.course_id,
      unlockAt: (module: CanvasModule) => module.unlock_at ?? null,
      items: (module: CanvasModule) => module.items ?? [],
    },

    ModuleItem: {
      htmlUrl: (item) => item.html_url ?? null,
      completed: (item) => item.completion_requirement?.completed ?? null,
    },

    User: {
      shortName: (user) => user.short_name ?? null,
      sortableName: (user) => user.sortable_name ?? null,
      avatarUrl: (user) => user.avatar_url ?? null,
      email: (user) => user.primary_email ?? null,
      timeZone: (user) => user.time_zone ?? null,
    },

    StudyBlock: {
      source: () => "canvas",
    },
  },
});
