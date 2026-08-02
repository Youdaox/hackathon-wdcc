-- Focus interruption detection and session pledges.
--
-- Hand-written to match 0001-0002, which are authored rather than generated.

-- What the user said at the return check-in, and what they guessed the
-- stretch was before the real number was revealed.
ALTER TABLE "distraction_events" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "distraction_events" ADD COLUMN "guessed_seconds" double precision;--> statement-breakpoint

-- Pledge stakes. `voided` records that a session happened but earned nothing,
-- rather than deleting it — the forfeit is the point.
ALTER TABLE "sessions" ADD COLUMN "committed_minutes" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "voided" boolean DEFAULT false NOT NULL;
