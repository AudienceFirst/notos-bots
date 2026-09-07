CREATE TABLE "model_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"bot_id" text DEFAULT '' NOT NULL,
	"provider" text NOT NULL,
	"model_name" text NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"cached_input_tokens" bigint DEFAULT 0 NOT NULL,
	"reasoning_tokens" bigint DEFAULT 0 NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "model_usage_workspace_at_idx" ON "model_usage" USING btree ("workspace_id","at");--> statement-breakpoint
CREATE INDEX "model_usage_model_at_idx" ON "model_usage" USING btree ("provider","model_name","at");
