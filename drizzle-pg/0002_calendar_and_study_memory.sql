CREATE TABLE "calendar_events" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "title" text NOT NULL, "event_date" text NOT NULL, "start_time" text NOT NULL, "end_time" text NOT NULL, "description" text DEFAULT '' NOT NULL, "location" text, "created_at" bigint NOT NULL, "updated_at" bigint NOT NULL);
--> statement-breakpoint
CREATE INDEX "calendar_events_user_date_idx" ON "calendar_events" ("user_id", "event_date");
--> statement-breakpoint
CREATE TABLE "calendar_feed_tokens" ("user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "token" text NOT NULL UNIQUE, "created_at" bigint NOT NULL);
--> statement-breakpoint
CREATE TABLE "study_memory_sessions" ("id" text PRIMARY KEY NOT NULL, "focus_session_id" text NOT NULL, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "title" text NOT NULL, "course" text NOT NULL, "status" text NOT NULL, "consent_version" text NOT NULL, "created_at" bigint NOT NULL, "completed_at" bigint, CONSTRAINT "study_memory_focus_user_unique" UNIQUE("focus_session_id", "user_id"));
--> statement-breakpoint
CREATE INDEX "study_memory_user_idx" ON "study_memory_sessions" ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE "study_observations" ("id" text PRIMARY KEY NOT NULL, "memory_session_id" text NOT NULL REFERENCES "study_memory_sessions"("id") ON DELETE CASCADE, "source_name" text NOT NULL, "captured_at" bigint NOT NULL, "image_hash" text NOT NULL, "extracted_text" text NOT NULL, "summary" text NOT NULL, "topics_json" text NOT NULL, "confidence" double precision NOT NULL, "created_at" bigint NOT NULL, CONSTRAINT "study_observation_hash_unique" UNIQUE("memory_session_id", "image_hash"));
--> statement-breakpoint
CREATE INDEX "study_observation_session_idx" ON "study_observations" ("memory_session_id", "captured_at");
--> statement-breakpoint
CREATE TABLE "study_chunks" ("id" text PRIMARY KEY NOT NULL, "memory_session_id" text NOT NULL REFERENCES "study_memory_sessions"("id") ON DELETE CASCADE, "observation_id" text NOT NULL REFERENCES "study_observations"("id") ON DELETE CASCADE, "content" text NOT NULL, "embedding_json" text NOT NULL, "embedding_model" text NOT NULL, "created_at" bigint NOT NULL);
--> statement-breakpoint
CREATE INDEX "study_chunks_session_idx" ON "study_chunks" ("memory_session_id");
--> statement-breakpoint
CREATE TABLE "recall_checks" ("id" text PRIMARY KEY NOT NULL, "memory_session_id" text NOT NULL REFERENCES "study_memory_sessions"("id") ON DELETE CASCADE, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "questions_json" text NOT NULL, "evidence_json" text NOT NULL, "status" text NOT NULL, "score" integer, "feedback_json" text, "xp_awarded" integer DEFAULT 0 NOT NULL, "created_at" bigint NOT NULL, "submitted_at" bigint, CONSTRAINT "recall_check_memory_unique" UNIQUE("memory_session_id"));
