ALTER TABLE "order_notifications"
  ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

UPDATE "order_notifications"
SET
  "attempt_count" = CASE
    WHEN "status" IN ('sent', 'failed', 'skipped') THEN 1
    ELSE 0
  END,
  "updated_at" = COALESCE("processed_at", "created_at");

CREATE INDEX "order_notifications_status_idx" ON "order_notifications" ("status");
CREATE INDEX "order_notifications_updated_at_idx" ON "order_notifications" ("updated_at");
