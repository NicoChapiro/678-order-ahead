CREATE TYPE "public"."store_code" AS ENUM('store_1', 'store_2', 'store_3');
CREATE TYPE "public"."weekday" AS ENUM('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
CREATE TYPE "public"."order_ahead_reason_code" AS ENUM(
  'manual_pause',
  'equipment_issue',
  'staffing_issue',
  'inventory_issue',
  'system_issue',
  'other'
);

CREATE TABLE "stores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" "store_code" NOT NULL,
  "name" varchar(120) NOT NULL,
  "timezone" varchar(64) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "stores_code_unique_idx" ON "stores" ("code");

CREATE TABLE "store_hours" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "weekday" "weekday" NOT NULL,
  "open_time" varchar(5) NOT NULL,
  "close_time" varchar(5) NOT NULL,
  "is_closed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_hours_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action
);
CREATE UNIQUE INDEX "store_hours_store_weekday_unique_idx" ON "store_hours" ("store_id", "weekday");

CREATE TABLE "store_order_ahead_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "disabled_reason_code" "order_ahead_reason_code",
  "disabled_comment" text,
  "updated_by_user_id" varchar(64) NOT NULL,
  "updated_by_role" varchar(32) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_order_ahead_settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "store_order_ahead_settings_reason_when_disabled_chk"
    CHECK ((is_enabled = true AND disabled_reason_code IS NULL) OR (is_enabled = false AND disabled_reason_code IS NOT NULL))
);
CREATE UNIQUE INDEX "store_order_ahead_settings_store_unique_idx" ON "store_order_ahead_settings" ("store_id");

CREATE TABLE "store_order_ahead_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "new_is_enabled" boolean NOT NULL,
  "reason_code" "order_ahead_reason_code",
  "comment" text,
  "changed_by_user_id" varchar(64) NOT NULL,
  "changed_by_role" varchar(32) NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_order_ahead_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "store_order_ahead_events_reason_when_disabled_chk"
    CHECK ((new_is_enabled = true AND reason_code IS NULL) OR (new_is_enabled = false AND reason_code IS NOT NULL))
);

INSERT INTO "stores" ("code", "name", "timezone")
VALUES ('store_1', 'NicoChapiro - Base Store', 'America/Argentina/Buenos_Aires');

INSERT INTO "store_hours" ("store_id", "weekday", "open_time", "close_time", "is_closed")
SELECT s."id", day.weekday::"weekday", '08:00', '20:00', false
FROM "stores" s
CROSS JOIN (VALUES ('mon'), ('tue'), ('wed'), ('thu'), ('fri')) AS day(weekday)
WHERE s."code" = 'store_1';

INSERT INTO "store_hours" ("store_id", "weekday", "open_time", "close_time", "is_closed")
SELECT s."id", day.weekday::"weekday", '00:00', '00:00', true
FROM "stores" s
CROSS JOIN (VALUES ('sat'), ('sun')) AS day(weekday)
WHERE s."code" = 'store_1';

INSERT INTO "store_order_ahead_settings" (
  "store_id",
  "is_enabled",
  "disabled_reason_code",
  "disabled_comment",
  "updated_by_user_id",
  "updated_by_role"
)
SELECT s."id", true, NULL, NULL, 'system', 'owner'
FROM "stores" s
WHERE s."code" = 'store_1';

INSERT INTO "store_order_ahead_events" (
  "store_id",
  "new_is_enabled",
  "reason_code",
  "comment",
  "changed_by_user_id",
  "changed_by_role"
)
SELECT s."id", true, NULL, 'Initial setup', 'system', 'owner'
FROM "stores" s
WHERE s."code" = 'store_1';
