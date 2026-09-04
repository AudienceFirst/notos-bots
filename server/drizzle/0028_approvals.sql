CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"thread_id" text,
	"bot_id" text NOT NULL,
	"tool_ref" text NOT NULL,
	"args_hash" text NOT NULL,
	"args" jsonb NOT NULL,
	"requested_by_actor" text,
	"decided_by" text,
	"decision" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_workspace_id_deployment_packages_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."deployment_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_key_idx" ON "approvals" USING btree ("bot_id","tool_ref","args_hash");--> statement-breakpoint
CREATE INDEX "approvals_workspace_idx" ON "approvals" USING btree ("workspace_id","created_at");