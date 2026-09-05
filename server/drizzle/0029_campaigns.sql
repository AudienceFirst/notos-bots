CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_email_pk" PRIMARY KEY("workspace_id","email")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "scope" text DEFAULT 'workspace' NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "personal_owner_id" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_deployment_packages_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."deployment_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_deployment_packages_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."deployment_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_workspace_slug_idx" ON "campaigns" USING btree ("workspace_id","slug");