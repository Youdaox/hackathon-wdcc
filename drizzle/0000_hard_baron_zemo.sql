CREATE TABLE `companions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`species` text NOT NULL,
	`level` integer NOT NULL,
	`xp` integer NOT NULL,
	`hp` real NOT NULL,
	`total_focused_ms` integer NOT NULL,
	`last_session_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `distraction_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`app_identifier` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `distraction_apps_user_idx` ON `distraction_apps` (`user_id`);--> statement-breakpoint
CREATE TABLE `distraction_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text,
	`app_identifier` text,
	`timestamp` integer NOT NULL,
	`duration_seconds` real NOT NULL,
	`bypassed` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `distraction_events_session_idx` ON `distraction_events` (`session_id`);--> statement-breakpoint
CREATE INDEX `distraction_events_user_idx` ON `distraction_events` (`user_id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`verified_minutes` real NOT NULL,
	`location_verified` integer NOT NULL,
	`location_name` text,
	`platform` text NOT NULL,
	`xp_earned` integer NOT NULL,
	`hp_delta` integer NOT NULL,
	`xp_multiplier` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`,`end_time`);--> statement-breakpoint
CREATE TABLE `study_spots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`radius_m` real NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `study_spots_user_idx` ON `study_spots` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
