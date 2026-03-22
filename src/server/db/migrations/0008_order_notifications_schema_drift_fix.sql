-- Fixes production schema drift behind the create-order 500 by ensuring
-- order_notifications has the columns now required by application code.
ALTER TABLE "order_notifications"
  ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "processed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE INDEX IF NOT EXISTS "order_notifications_updated_at_idx"
  ON "order_notifications" ("updated_at");
