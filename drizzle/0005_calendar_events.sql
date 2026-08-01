CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`event_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`location` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendar_events_user_date_idx` ON `calendar_events` (`user_id`,`event_date`);--> statement-breakpoint
CREATE TABLE `calendar_feed_tokens` (
	`user_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feed_tokens_token_unique` ON `calendar_feed_tokens` (`token`);
