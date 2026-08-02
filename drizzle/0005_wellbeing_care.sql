ALTER TABLE `companions` ADD `last_meal` text;--> statement-breakpoint
ALTER TABLE `companions` ADD `last_meal_at` integer;--> statement-breakpoint
ALTER TABLE `companions` ADD `last_water_at` integer;--> statement-breakpoint
ALTER TABLE `companions` ADD `food_break_missed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `companions` ADD `water_break_missed` integer DEFAULT false NOT NULL;
