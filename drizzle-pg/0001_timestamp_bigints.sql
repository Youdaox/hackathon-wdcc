ALTER TABLE "users" ALTER COLUMN "created_at" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "expires_at" TYPE bigint, ALTER COLUMN "created_at" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "friendships" ALTER COLUMN "created_at" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "companions" ALTER COLUMN "check_in_at" TYPE bigint, ALTER COLUMN "next_check_in_at" TYPE bigint, ALTER COLUMN "last_meal_at" TYPE bigint, ALTER COLUMN "last_water_at" TYPE bigint, ALTER COLUMN "next_water_check_at" TYPE bigint, ALTER COLUMN "total_focused_ms" TYPE bigint, ALTER COLUMN "last_session_at" TYPE bigint, ALTER COLUMN "created_at" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "start_time" TYPE bigint, ALTER COLUMN "end_time" TYPE bigint, ALTER COLUMN "created_at" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "distraction_events" ALTER COLUMN "timestamp" TYPE bigint, ALTER COLUMN "created_at" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "distraction_apps" ALTER COLUMN "created_at" TYPE bigint;
--> statement-breakpoint
ALTER TABLE "study_spots" ALTER COLUMN "created_at" TYPE bigint;
