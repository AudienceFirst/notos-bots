CREATE TABLE "model_provider_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"scope_id" text DEFAULT '' NOT NULL,
	"provider" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"encrypted_key" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_packages" ADD COLUMN "model_provider" text DEFAULT 'vertex' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "model_provider_keys_owner_idx" ON "model_provider_keys" USING btree ("scope","scope_id","provider");