ALTER TABLE `users` ADD `username` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `display_name` text;--> statement-breakpoint
UPDATE `users`
SET `username` = `id`, `password_hash` = 'legacy-account-reset-required', `display_name` = `id`
WHERE `username` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `token_hash` text NOT NULL,
  `user_id` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_unique` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);
