CREATE TABLE `friendships` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `friend_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`friend_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `friendships_user_idx` ON `friendships` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_pair_unique` ON `friendships` (`user_id`, `friend_id`);
