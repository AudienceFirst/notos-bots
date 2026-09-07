ALTER TABLE "routines" ADD COLUMN "trigger" text DEFAULT 'schedule' NOT NULL;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "keyword" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "routines_by_trigger_idx" ON "routines" USING btree ("trigger","channel_id","enabled");
