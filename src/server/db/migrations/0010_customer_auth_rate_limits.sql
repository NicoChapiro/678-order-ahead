CREATE TABLE IF NOT EXISTS "customer_auth_rate_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "action" varchar(64) NOT NULL,
  "scope_key" varchar(191) NOT NULL,
  "hit_count" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "blocked_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_auth_rate_limits_action_scope_unique_idx"
  ON "customer_auth_rate_limits" ("action", "scope_key");

CREATE INDEX IF NOT EXISTS "customer_auth_rate_limits_action_blocked_until_idx"
  ON "customer_auth_rate_limits" ("action", "blocked_until");
