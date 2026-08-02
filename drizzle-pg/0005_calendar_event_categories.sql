ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'study' NOT NULL;
