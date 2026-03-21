CREATE TYPE "public"."order_status" AS ENUM(
  'pending_acceptance',
  'accepted',
  'rejected',
  'cancelled_by_customer',
  'ready_for_pickup',
  'completed',
  'no_show'
);

CREATE TABLE "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_identifier" varchar(120) NOT NULL,
  "store_id" uuid NOT NULL,
  "status" "order_status" DEFAULT 'pending_acceptance' NOT NULL,
  "currency_code" varchar(3) DEFAULT 'CLP' NOT NULL,
  "total_amount" integer NOT NULL,
  "placed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "accepted_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "ready_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "no_show_at" timestamp with time zone,
  "rejection_reason" text,
  "cancellation_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "orders_store_id_stores_id_fk"
    FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "orders_total_amount_positive_chk" CHECK ("total_amount" > 0),
  CONSTRAINT "orders_currency_code_clp_chk" CHECK ("currency_code" = 'CLP')
);
CREATE INDEX "orders_store_id_idx" ON "orders" ("store_id");
CREATE INDEX "orders_customer_identifier_idx" ON "orders" ("customer_identifier");
CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at" DESC);

CREATE TABLE "order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "menu_item_id" uuid NOT NULL,
  "store_menu_item_id" uuid NOT NULL,
  "item_name_snapshot" varchar(120) NOT NULL,
  "unit_price_amount" integer NOT NULL,
  "quantity" integer NOT NULL,
  "line_total_amount" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "order_items_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "order_items_menu_item_id_menu_items_id_fk"
    FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "order_items_store_menu_item_id_store_menu_items_id_fk"
    FOREIGN KEY ("store_menu_item_id") REFERENCES "public"."store_menu_items"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "order_items_unit_price_amount_positive_chk" CHECK ("unit_price_amount" > 0),
  CONSTRAINT "order_items_quantity_positive_chk" CHECK ("quantity" > 0),
  CONSTRAINT "order_items_line_total_amount_positive_chk" CHECK ("line_total_amount" > 0)
);
CREATE INDEX "order_items_order_id_idx" ON "order_items" ("order_id");

CREATE TABLE "customer_order_flags" (
  "customer_identifier" varchar(120) PRIMARY KEY NOT NULL,
  "no_show_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_order_flags_no_show_count_non_negative_chk" CHECK ("no_show_count" >= 0)
);
CREATE INDEX "customer_order_flags_no_show_count_idx" ON "customer_order_flags" ("no_show_count");
