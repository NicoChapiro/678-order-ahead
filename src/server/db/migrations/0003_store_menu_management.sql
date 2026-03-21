CREATE TABLE "menu_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(120) NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "menu_items_code_unique_idx" ON "menu_items" ("code");

CREATE TABLE "store_menu_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "menu_item_id" uuid NOT NULL,
  "price_amount" integer NOT NULL,
  "currency_code" varchar(3) DEFAULT 'CLP' NOT NULL,
  "is_visible" boolean DEFAULT true NOT NULL,
  "is_in_stock" boolean DEFAULT true NOT NULL,
  "sort_order" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "store_menu_items_store_id_stores_id_fk"
    FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "store_menu_items_menu_item_id_menu_items_id_fk"
    FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "store_menu_items_price_amount_positive_chk" CHECK ("price_amount" > 0),
  CONSTRAINT "store_menu_items_currency_code_clp_chk" CHECK ("currency_code" = 'CLP')
);
CREATE UNIQUE INDEX "store_menu_items_store_menu_item_unique_idx"
  ON "store_menu_items" ("store_id", "menu_item_id");

INSERT INTO "menu_items" ("code", "name", "description", "is_active")
VALUES
  ('espresso', 'Espresso', 'Single espresso shot.', true),
  ('latte', 'Caffe Latte', 'Espresso with steamed milk.', true),
  ('cappuccino', 'Cappuccino', 'Espresso with milk foam.', true),
  ('croissant', 'Butter Croissant', 'Fresh baked butter croissant.', true);

INSERT INTO "store_menu_items" (
  "store_id",
  "menu_item_id",
  "price_amount",
  "currency_code",
  "is_visible",
  "is_in_stock",
  "sort_order"
)
SELECT
  s."id",
  m."id",
  pricing.price_amount,
  'CLP',
  true,
  true,
  pricing.sort_order
FROM "stores" s
JOIN (
  VALUES
    ('espresso', 1800, 1),
    ('latte', 2600, 2),
    ('cappuccino', 2500, 3),
    ('croissant', 2200, 4)
) AS pricing(code, price_amount, sort_order) ON true
JOIN "menu_items" m ON m."code" = pricing.code
WHERE s."code" = 'store_1';
