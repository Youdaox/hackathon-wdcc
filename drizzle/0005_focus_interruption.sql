-- Focus interruption detection and session pledges.
--
-- Hand-written to match 0002-0004: this project's later migrations are
-- authored rather than generated, and there are no drizzle snapshots past
-- 0001 to diff against.

-- What the user said on the return check-in, and what they guessed the
-- stretch was before the real number was revealed.
ALTER TABLE `distraction_events` ADD `reason` text;--> statement-breakpoint
ALTER TABLE `distraction_events` ADD `guessed_seconds` real;--> statement-breakpoint

-- Replaces `app_identifier`. That column held an OS-reported Android package
-- name; this one holds a user-supplied label from a Shortcuts automation, so
-- it is a display string and never matched against anything.
ALTER TABLE `distraction_events` ADD `app_label` text;--> statement-breakpoint

-- Pledge stakes. `voided` records that a session happened but earned nothing,
-- rather than deleting it — the forfeit is the point.
ALTER TABLE `sessions` ADD `committed_minutes` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `voided` integer DEFAULT false NOT NULL;
