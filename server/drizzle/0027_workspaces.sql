ALTER TABLE "threads" ALTER COLUMN "workspace_id" SET DATA TYPE uuid USING "workspace_id"::uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "notos_client_id" text;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "kind" text DEFAULT 'real' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "vertex_location" text DEFAULT 'europe-west4' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "default_model" text DEFAULT 'gemini-2.5-pro' NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "drive_root_ids" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "action_policy" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspace_id_deployment_packages_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."deployment_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspace_id_deployment_packages_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."deployment_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_policy" ADD CONSTRAINT "action_policy_workspace_id_deployment_packages_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."deployment_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_workspace_id_deployment_packages_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."deployment_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_workspace_id_deployment_packages_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."deployment_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD CONSTRAINT "deployment_packages_notos_client_id_unique" UNIQUE("notos_client_id");--> statement-breakpoint
-- NOTOS: backfill. Every row that exists belongs to the one package this deployment had before
-- workspaces existed; the package itself gets its tenant id as NOTOS client id.
UPDATE "deployment_packages" SET "notos_client_id" = "tenant_id", "display_name" = "tenant_id" WHERE "notos_client_id" IS NULL;--> statement-breakpoint
UPDATE "agents" SET "workspace_id" = (SELECT "id" FROM "deployment_packages" LIMIT 1) WHERE "workspace_id" IS NULL AND (SELECT count(*) FROM "deployment_packages") = 1;--> statement-breakpoint
UPDATE "channels" SET "workspace_id" = (SELECT "id" FROM "deployment_packages" LIMIT 1) WHERE "workspace_id" IS NULL AND (SELECT count(*) FROM "deployment_packages") = 1;--> statement-breakpoint
UPDATE "routines" SET "workspace_id" = (SELECT "id" FROM "deployment_packages" LIMIT 1) WHERE "workspace_id" IS NULL AND (SELECT count(*) FROM "deployment_packages") = 1;--> statement-breakpoint
UPDATE "threads" SET "workspace_id" = (SELECT "id" FROM "deployment_packages" LIMIT 1) WHERE "workspace_id" IS NULL AND (SELECT count(*) FROM "deployment_packages") = 1;
