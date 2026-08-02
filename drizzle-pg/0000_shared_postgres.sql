CREATE TABLE "users" ("id" text PRIMARY KEY NOT NULL, "username" text NOT NULL UNIQUE, "password_hash" text NOT NULL, "display_name" text NOT NULL, "created_at" integer NOT NULL);
--> statement-breakpoint
CREATE TABLE "auth_sessions" ("id" text PRIMARY KEY NOT NULL, "token_hash" text NOT NULL UNIQUE, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "expires_at" integer NOT NULL, "created_at" integer NOT NULL);
--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" ("user_id");
--> statement-breakpoint
CREATE TABLE "friendships" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "friend_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "created_at" integer NOT NULL, CONSTRAINT "friendships_pair_unique" UNIQUE("user_id", "friend_id"));
--> statement-breakpoint
CREATE INDEX "friendships_user_idx" ON "friendships" ("user_id");
--> statement-breakpoint
CREATE TABLE "companions" ("user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "name" text NOT NULL, "species" text NOT NULL, "color" text DEFAULT 'pink' NOT NULL, "accessory" text DEFAULT 'none' NOT NULL, "check_in_emotion" text, "check_in_at" integer, "next_check_in_at" integer, "last_meal" text, "last_meal_at" integer, "last_water_at" integer, "next_water_check_at" integer, "food_break_missed" boolean DEFAULT false NOT NULL, "water_break_missed" boolean DEFAULT false NOT NULL, "level" integer NOT NULL, "xp" integer NOT NULL, "hp" double precision NOT NULL, "total_focused_ms" integer NOT NULL, "last_session_at" integer, "created_at" integer NOT NULL);
--> statement-breakpoint
CREATE TABLE "sessions" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "start_time" integer NOT NULL, "end_time" integer NOT NULL, "verified_minutes" double precision NOT NULL, "location_verified" boolean NOT NULL, "location_name" text, "platform" text NOT NULL, "xp_earned" integer NOT NULL, "hp_delta" integer NOT NULL, "xp_multiplier" double precision NOT NULL, "created_at" integer NOT NULL);
--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id", "end_time");
--> statement-breakpoint
CREATE TABLE "distraction_events" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "session_id" text REFERENCES "sessions"("id") ON DELETE CASCADE, "app_identifier" text, "timestamp" integer NOT NULL, "duration_seconds" double precision NOT NULL, "bypassed" boolean NOT NULL, "created_at" integer NOT NULL);
--> statement-breakpoint
CREATE INDEX "distraction_events_session_idx" ON "distraction_events" ("session_id");
--> statement-breakpoint
CREATE INDEX "distraction_events_user_idx" ON "distraction_events" ("user_id", "timestamp");
--> statement-breakpoint
CREATE TABLE "distraction_apps" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "app_identifier" text NOT NULL, "created_at" integer NOT NULL);
--> statement-breakpoint
CREATE INDEX "distraction_apps_user_idx" ON "distraction_apps" ("user_id");
--> statement-breakpoint
CREATE TABLE "study_spots" ("id" text PRIMARY KEY NOT NULL, "user_id" text REFERENCES "users"("id") ON DELETE CASCADE, "name" text NOT NULL, "lat" double precision NOT NULL, "lng" double precision NOT NULL, "radius_m" double precision NOT NULL, "multiplier" double precision DEFAULT 1 NOT NULL, "created_at" integer NOT NULL);
--> statement-breakpoint
CREATE INDEX "study_spots_user_idx" ON "study_spots" ("user_id");
--> statement-breakpoint
CREATE TABLE "leaderboard_state" ("id" boolean PRIMARY KEY DEFAULT true, "snapshot" jsonb NOT NULL, CONSTRAINT "leaderboard_state_one_row" CHECK (id));
