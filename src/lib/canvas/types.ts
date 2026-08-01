/**
 * Canvas LMS domain types.
 *
 * These mirror the JSON shapes returned by the Canvas REST API (`/api/v1/...`),
 * narrowed to the fields Incline actually uses. Field names are kept in Canvas'
 * snake_case so the live client can hand raw JSON straight through — the
 * GraphQL layer is the only place names get camelised.
 *
 * Canvas API reference: https://canvas.instructure.com/doc/api/
 */

export interface CanvasUser {
  id: string;
  name: string;
  short_name?: string;
  sortable_name?: string;
  avatar_url?: string;
  primary_email?: string;
  time_zone?: string;
}

export type EnrollmentType =
  | "StudentEnrollment"
  | "TeacherEnrollment"
  | "TaEnrollment"
  | "ObserverEnrollment"
  | "DesignerEnrollment";

export interface CanvasEnrollment {
  id: string;
  course_id: string;
  user_id: string;
  type: EnrollmentType;
  enrollment_state: string;
  /** Only present when the caller may see grades. */
  grades?: {
    current_score?: number | null;
    final_score?: number | null;
    current_grade?: string | null;
    final_grade?: string | null;
  };
}

export interface CanvasCourse {
  id: string;
  name: string;
  /** e.g. "COMPSCI 235" — Incline uses this as the `course` on a StudyBlock. */
  course_code: string;
  workflow_state: string;
  start_at?: string | null;
  end_at?: string | null;
  term?: { id: string; name: string } | null;
  enrollments?: CanvasEnrollment[];
}

export type SubmissionType =
  | "online_text_entry"
  | "online_url"
  | "online_upload"
  | "online_quiz"
  | "discussion_topic"
  | "on_paper"
  | "none";

export interface CanvasAssignment {
  id: string;
  course_id: string;
  name: string;
  description?: string | null;
  due_at?: string | null;
  unlock_at?: string | null;
  lock_at?: string | null;
  points_possible?: number | null;
  html_url: string;
  submission_types: SubmissionType[];
  published: boolean;
  /** Present when the request asked for `include[]=submission`. */
  submission?: CanvasSubmission | null;
}

export interface CanvasSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  submitted_at?: string | null;
  graded_at?: string | null;
  score?: number | null;
  grade?: string | null;
  late: boolean;
  missing: boolean;
  excused?: boolean | null;
  workflow_state: string;
  attempt?: number | null;
}

export type CalendarEventType = "event" | "assignment";

export interface CanvasCalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  location_name?: string | null;
  /** e.g. "course_1234" — the context the event hangs off. */
  context_code: string;
  context_name?: string | null;
  type: CalendarEventType;
  html_url: string;
  /** Canvas repeats recurring events by materialising each occurrence. */
  workflow_state?: string;
}

export interface CanvasModuleItem {
  id: string;
  module_id: string;
  title: string;
  type: string;
  html_url?: string;
  completion_requirement?: { type: string; completed?: boolean } | null;
}

export interface CanvasModule {
  id: string;
  course_id: string;
  name: string;
  position: number;
  state?: string | null;
  unlock_at?: string | null;
  items?: CanvasModuleItem[];
}

/** The shape Incline's schedule table stores. Mirrors `StudyBlock` in `../types`. */
export interface CanvasDerivedBlock {
  externalId: string;
  title: string;
  course: string;
  startMin: number;
  endMin: number;
  days: number[];
}
