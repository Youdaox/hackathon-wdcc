CREATE TABLE `study_memory_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`focus_session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`course` text NOT NULL,
	`status` text NOT NULL,
	`consent_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_memory_focus_user_unique` ON `study_memory_sessions` (`focus_session_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `study_memory_user_idx` ON `study_memory_sessions` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `study_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`memory_session_id` text NOT NULL,
	`source_name` text NOT NULL,
	`captured_at` integer NOT NULL,
	`image_hash` text NOT NULL,
	`extracted_text` text NOT NULL,
	`summary` text NOT NULL,
	`topics_json` text NOT NULL,
	`confidence` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`memory_session_id`) REFERENCES `study_memory_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_observation_hash_unique` ON `study_observations` (`memory_session_id`,`image_hash`);
--> statement-breakpoint
CREATE INDEX `study_observation_session_idx` ON `study_observations` (`memory_session_id`,`captured_at`);
--> statement-breakpoint
CREATE TABLE `study_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`memory_session_id` text NOT NULL,
	`observation_id` text NOT NULL,
	`content` text NOT NULL,
	`embedding_json` text NOT NULL,
	`embedding_model` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`memory_session_id`) REFERENCES `study_memory_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`observation_id`) REFERENCES `study_observations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `study_chunks_session_idx` ON `study_chunks` (`memory_session_id`);
--> statement-breakpoint
CREATE TABLE `recall_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`memory_session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`questions_json` text NOT NULL,
	`evidence_json` text NOT NULL,
	`status` text NOT NULL,
	`score` integer,
	`feedback_json` text,
	`xp_awarded` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`submitted_at` integer,
	FOREIGN KEY (`memory_session_id`) REFERENCES `study_memory_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recall_check_memory_unique` ON `recall_checks` (`memory_session_id`);
