import type { CanvasSource } from "./source";
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
 * In-memory Canvas fixtures.
 *
 * Used whenever `CANVAS_BASE_URL` / `CANVAS_ACCESS_TOKEN` are unset, so the
 * GraphQL API is fully explorable with no Canvas account — the demo path, and
 * what CI runs against.
 *
 * Dates are generated relative to the current week rather than hardcoded, so
 * "upcoming" assignments and "this week's" lectures stay upcoming forever
 * instead of rotting into the past.
 */

const DAY_MS = 86_400_000;

/** Midnight Monday of the current week, local time. */
function weekStart(now = new Date()): Date {
  const monday = new Date(now);
  const offset = (monday.getDay() + 6) % 7; // 0 = Sunday → 6 days after Monday
  monday.setDate(monday.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** ISO timestamp for `dayIndex` (0 = Monday) of this week at `hour`:`minute`. */
function atWeekday(dayIndex: number, hour: number, minute = 0): string {
  const date = weekStart();
  date.setDate(date.getDate() + dayIndex);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** ISO timestamp `days` from now at `hour` — used for due dates. */
function inDays(days: number, hour = 23, minute = 59): string {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

const SELF: CanvasUser = {
  id: "1",
  name: "Demo Student",
  short_name: "Demo",
  sortable_name: "Student, Demo",
  primary_email: "demo@aucklanduni.ac.nz",
  time_zone: "Pacific/Auckland",
};

const TERM = { id: "42", name: "Semester Two 2026" };

const COURSES: CanvasCourse[] = [
  {
    id: "101",
    name: "Software Design Methodology",
    course_code: "COMPSCI 235",
    workflow_state: "available",
    start_at: inDays(-30, 9, 0),
    end_at: inDays(60, 17, 0),
    term: TERM,
  },
  {
    id: "102",
    name: "Algorithms and Data Structures",
    course_code: "COMPSCI 220",
    workflow_state: "available",
    start_at: inDays(-30, 9, 0),
    end_at: inDays(60, 17, 0),
    term: TERM,
  },
  {
    id: "103",
    name: "Linear Algebra",
    course_code: "MATHS 208",
    workflow_state: "available",
    start_at: inDays(-30, 9, 0),
    end_at: inDays(60, 17, 0),
    term: TERM,
  },
];

const ENROLLMENTS: CanvasEnrollment[] = [
  {
    id: "9001",
    course_id: "101",
    user_id: "1",
    type: "StudentEnrollment",
    enrollment_state: "active",
    grades: { current_score: 78.5, final_score: 71.2, current_grade: "B+", final_grade: "B" },
  },
  {
    id: "9002",
    course_id: "102",
    user_id: "1",
    type: "StudentEnrollment",
    enrollment_state: "active",
    grades: { current_score: 64, final_score: 58, current_grade: "C+", final_grade: "C" },
  },
  {
    id: "9003",
    course_id: "103",
    user_id: "1",
    type: "StudentEnrollment",
    enrollment_state: "active",
    grades: { current_score: 88, final_score: 84, current_grade: "A", final_grade: "A-" },
  },
];

const SUBMISSIONS: CanvasSubmission[] = [
  {
    id: "5001",
    assignment_id: "201",
    user_id: "1",
    submitted_at: inDays(-5, 22, 10),
    graded_at: inDays(-2, 9, 0),
    score: 17,
    grade: "17",
    late: false,
    missing: false,
    excused: false,
    workflow_state: "graded",
    attempt: 1,
  },
  {
    id: "5002",
    assignment_id: "203",
    user_id: "1",
    submitted_at: null,
    graded_at: null,
    score: null,
    grade: null,
    late: false,
    missing: true,
    excused: false,
    workflow_state: "unsubmitted",
    attempt: null,
  },
];

const ASSIGNMENTS: CanvasAssignment[] = [
  {
    id: "201",
    course_id: "101",
    name: "Design Patterns Report",
    description: "<p>Apply three GoF patterns to the provided codebase and justify each.</p>",
    due_at: inDays(-5),
    unlock_at: inDays(-19, 9, 0),
    lock_at: inDays(-3),
    points_possible: 20,
    html_url: "https://canvas.example.edu/courses/101/assignments/201",
    submission_types: ["online_upload"],
    published: true,
  },
  {
    id: "202",
    course_id: "101",
    name: "Refactoring Exercise",
    description: "<p>Break the god object in <code>OrderService</code> apart.</p>",
    due_at: inDays(4),
    unlock_at: inDays(-3, 9, 0),
    lock_at: null,
    points_possible: 15,
    html_url: "https://canvas.example.edu/courses/101/assignments/202",
    submission_types: ["online_upload", "online_text_entry"],
    published: true,
  },
  {
    id: "203",
    course_id: "102",
    name: "Graph Algorithms Problem Set",
    description: "<p>Dijkstra, Bellman-Ford, and a complexity argument for each.</p>",
    due_at: inDays(2),
    unlock_at: inDays(-7, 9, 0),
    lock_at: null,
    points_possible: 25,
    html_url: "https://canvas.example.edu/courses/102/assignments/203",
    submission_types: ["online_upload"],
    published: true,
  },
  {
    id: "204",
    course_id: "102",
    name: "Midsemester Test",
    description: "<p>Closed book, 90 minutes.</p>",
    due_at: inDays(11, 14, 0),
    unlock_at: null,
    lock_at: null,
    points_possible: 30,
    html_url: "https://canvas.example.edu/courses/102/assignments/204",
    submission_types: ["on_paper"],
    published: true,
  },
  {
    id: "205",
    course_id: "103",
    name: "Eigenvalues Quiz",
    description: "<p>Ten questions on diagonalisation.</p>",
    due_at: inDays(6, 17, 0),
    unlock_at: inDays(-1, 9, 0),
    lock_at: inDays(6, 17, 0),
    points_possible: 10,
    html_url: "https://canvas.example.edu/courses/103/assignments/205",
    submission_types: ["online_quiz"],
    published: true,
  },
];

const MODULES: CanvasModule[] = [
  {
    id: "301",
    course_id: "101",
    name: "Week 1–3: Principles",
    position: 1,
    state: "completed",
    unlock_at: inDays(-28, 9, 0),
    items: [
      { id: "3011", module_id: "301", title: "SOLID in practice", type: "Page", html_url: "#" },
      { id: "3012", module_id: "301", title: "Coupling and cohesion", type: "Page", html_url: "#" },
    ],
  },
  {
    id: "302",
    course_id: "101",
    name: "Week 4–6: Patterns",
    position: 2,
    state: "started",
    unlock_at: inDays(-7, 9, 0),
    items: [
      { id: "3021", module_id: "302", title: "Creational patterns", type: "Page", html_url: "#" },
      {
        id: "3022",
        module_id: "302",
        title: "Design Patterns Report",
        type: "Assignment",
        html_url: "https://canvas.example.edu/courses/101/assignments/201",
        completion_requirement: { type: "must_submit", completed: true },
      },
    ],
  },
  {
    id: "303",
    course_id: "102",
    name: "Graphs",
    position: 1,
    state: "started",
    unlock_at: inDays(-14, 9, 0),
    items: [{ id: "3031", module_id: "303", title: "Shortest paths", type: "Page", html_url: "#" }],
  },
];

/** Weekly timetable: [courseId, label, weekday (0 = Monday), startHour, endHour, room]. */
const TIMETABLE: Array<[string, string, number, number, number, string]> = [
  ["101", "COMPSCI 235 Lecture", 0, 10, 11, "OGGB/260-051"],
  ["101", "COMPSCI 235 Lecture", 2, 10, 11, "OGGB/260-051"],
  ["101", "COMPSCI 235 Lab", 3, 14, 16, "Science/303-G75"],
  ["102", "COMPSCI 220 Lecture", 1, 9, 10, "Eng/401-401"],
  ["102", "COMPSCI 220 Lecture", 3, 9, 10, "Eng/401-401"],
  ["102", "COMPSCI 220 Tutorial", 4, 13, 14, "Science/303-G14"],
  ["103", "MATHS 208 Lecture", 0, 13, 14, "MLT/303-B05"],
  ["103", "MATHS 208 Lecture", 2, 13, 14, "MLT/303-B05"],
  ["103", "MATHS 208 Tutorial", 4, 11, 12, "Science/303-257"],
];

/** Materialises this week's timetable as Canvas calendar events. */
function calendarEvents(): CanvasCalendarEvent[] {
  return TIMETABLE.map(([courseId, title, weekday, startHour, endHour, room], index) => {
    const course = COURSES.find((c) => c.id === courseId)!;
    return {
      id: `4${String(index).padStart(3, "0")}`,
      title,
      description: null,
      start_at: atWeekday(weekday, startHour),
      end_at: atWeekday(weekday, endHour),
      location_name: room,
      context_code: `course_${courseId}`,
      context_name: course.name,
      type: "event" as const,
      html_url: `https://canvas.example.edu/calendar?event_id=4${index}`,
      workflow_state: "active",
    };
  });
}

const EVENTS = calendarEvents();

/** Assignment list with the caller's submission attached, as Canvas does. */
function withSubmission(assignment: CanvasAssignment): CanvasAssignment {
  return {
    ...assignment,
    submission: SUBMISSIONS.find((s) => s.assignment_id === assignment.id) ?? null,
  };
}

export function mockSource(): CanvasSource {
  return {
    kind: "mock",

    self: async () => SELF,

    courses: async ({ enrollmentState = "active" }) =>
      COURSES.filter(() => enrollmentState !== "completed").map((course) => ({
        ...course,
        enrollments: ENROLLMENTS.filter((e) => e.course_id === course.id),
      })),

    course: async (id) => {
      const course = COURSES.find((c) => c.id === id);
      if (!course) return null;
      return { ...course, enrollments: ENROLLMENTS.filter((e) => e.course_id === course.id) };
    },

    enrollments: async (courseId) => ENROLLMENTS.filter((e) => e.course_id === courseId),

    assignments: async (courseId, { bucket }) => {
      const now = Date.now();
      return ASSIGNMENTS.filter((a) => a.course_id === courseId)
        .filter((a) => {
          if (!bucket) return true;
          const due = a.due_at ? Date.parse(a.due_at) : null;
          if (bucket === "upcoming") return due !== null && due > now;
          if (bucket === "past") return due !== null && due <= now;
          if (bucket === "unsubmitted") {
            return !SUBMISSIONS.find((s) => s.assignment_id === a.id)?.submitted_at;
          }
          return true;
        })
        .map(withSubmission);
    },

    assignment: async (courseId, id) => {
      const found = ASSIGNMENTS.find((a) => a.id === id && a.course_id === courseId);
      return found ? withSubmission(found) : null;
    },

    submission: async (_courseId, assignmentId) =>
      SUBMISSIONS.find((s) => s.assignment_id === assignmentId) ?? null,

    modules: async (courseId) => MODULES.filter((m) => m.course_id === courseId),

    calendarEvents: async ({ contextCodes, startDate, endDate }) => {
      const from = startDate ? Date.parse(startDate) : null;
      const to = endDate ? Date.parse(endDate) : null;
      return EVENTS.filter((event) => {
        if (contextCodes.length && !contextCodes.includes(event.context_code)) return false;
        const start = event.start_at ? Date.parse(event.start_at) : null;
        if (start === null) return true;
        if (from !== null && start < from) return false;
        if (to !== null && start > to) return false;
        return true;
      });
    },
  };
}
