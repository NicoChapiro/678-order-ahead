CREATE TYPE "public"."order_notification_type" AS ENUM(
  'order_accepted',
  'order_rejected',
  'order_ready',
  'order_completed',
  'order_cancelled',
  'order_no_show'
);

CREATE TYPE "public"."order_notification_channel" AS ENUM(
  'internal',
  'push',
  'whatsapp',
  'sms'
);

CREATE TYPE "public"."order_notification_status" AS ENUM(
  'pending',
  'skipped',
  'sent',
  'failed'
);

CREATE TYPE "public"."order_event_type" AS ENUM(
  'order_created',
  'order_accepted',
  'order_rejected',
  'order_ready',
  'order_completed',
  'order_cancelled',
  'order_no_show'
);

CREATE TABLE "order_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "notification_type" "order_notification_type" NOT NULL,
  "channel" "order_notification_channel" DEFAULT 'internal' NOT NULL,
  "status" "order_notification_status" DEFAULT 'pending' NOT NULL,
  "recipient_customer_identifier" varchar(120),
  "payload_json" jsonb,
  "failure_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  CONSTRAINT "order_notifications_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX "order_notifications_order_id_idx" ON "order_notifications" ("order_id");
CREATE INDEX "order_notifications_created_at_idx" ON "order_notifications" ("created_at");

CREATE TABLE "order_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "event_type" "order_event_type" NOT NULL,
  "actor_user_id" varchar(120),
  "actor_role" varchar(32),
  "metadata_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "order_events_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX "order_events_order_id_idx" ON "order_events" ("order_id");
CREATE INDEX "order_events_created_at_idx" ON "order_events" ("created_at");
