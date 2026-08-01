ALTER TABLE `distraction_events` ADD `app_label` text;--> statement-breakpoint
ALTER TABLE `distraction_events` ADD `bypassed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `committed_minutes` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `voided` integer DEFAULT false NOT NULL;