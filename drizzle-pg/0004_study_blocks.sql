-- Weekly study blocks, so the schedule is shared between web and mobile
-- instead of living only in one browser's localStorage.
CREATE TABLE IF NOT EXISTS "study_blocks" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "course" text NOT NULL,
  "start_min" integer NOT NULL,
  "end_min" integer NOT NULL,
  "days" text NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "external_id" text,
  "created_at" bigint NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_blocks_user_idx" ON "study_blocks" ("user_id");
