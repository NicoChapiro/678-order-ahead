CREATE TYPE "public"."wallet_entry_type" AS ENUM(
  'topup_card',
  'topup_transfer',
  'topup_cashier',
  'topup_mercado_pago',
  'admin_adjustment_credit',
  'admin_adjustment_debit',
  'order_payment',
  'order_reversal'
);
CREATE TYPE "public"."wallet_entry_status" AS ENUM('posted', 'pending', 'cancelled');
CREATE TYPE "public"."wallet_reference_type" AS ENUM(
  'manual_topup',
  'cashier_topup',
  'admin_adjustment',
  'order'
);
CREATE TYPE "public"."wallet_topup_method" AS ENUM('card', 'transfer', 'cashier', 'mercado_pago');
CREATE TYPE "public"."wallet_topup_request_status" AS ENUM('pending', 'approved', 'rejected');

CREATE TABLE "customer_wallets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_identifier" varchar(120) NOT NULL,
  "currency_code" varchar(3) DEFAULT 'CLP' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_wallets_currency_code_clp_chk" CHECK ("currency_code" = 'CLP')
);
CREATE UNIQUE INDEX "customer_wallets_customer_identifier_unique_idx"
  ON "customer_wallets" ("customer_identifier");

CREATE TABLE "wallet_ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_id" uuid NOT NULL,
  "entry_type" "wallet_entry_type" NOT NULL,
  "amount_signed" integer NOT NULL,
  "currency_code" varchar(3) DEFAULT 'CLP' NOT NULL,
  "status" "wallet_entry_status" DEFAULT 'posted' NOT NULL,
  "reference_type" "wallet_reference_type",
  "reference_id" varchar(120),
  "external_reference" varchar(191),
  "note" text,
  "created_by_user_id" varchar(64),
  "created_by_role" varchar(32),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wallet_ledger_entries_wallet_id_customer_wallets_id_fk"
    FOREIGN KEY ("wallet_id") REFERENCES "public"."customer_wallets"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "wallet_ledger_entries_amount_non_zero_chk" CHECK ("amount_signed" <> 0),
  CONSTRAINT "wallet_ledger_entries_currency_code_clp_chk" CHECK ("currency_code" = 'CLP')
);
CREATE INDEX "wallet_ledger_entries_wallet_id_idx" ON "wallet_ledger_entries" ("wallet_id");
CREATE INDEX "wallet_ledger_entries_created_at_idx" ON "wallet_ledger_entries" ("created_at");
CREATE INDEX "wallet_ledger_entries_wallet_id_created_at_idx"
  ON "wallet_ledger_entries" ("wallet_id", "created_at" DESC);

CREATE TABLE "wallet_topup_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_id" uuid NOT NULL,
  "method" "wallet_topup_method" NOT NULL,
  "requested_amount" integer NOT NULL,
  "status" "wallet_topup_request_status" DEFAULT 'pending' NOT NULL,
  "submitted_reference" varchar(191),
  "reviewed_by_user_id" varchar(64),
  "reviewed_at" timestamp with time zone,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wallet_topup_requests_wallet_id_customer_wallets_id_fk"
    FOREIGN KEY ("wallet_id") REFERENCES "public"."customer_wallets"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "wallet_topup_requests_requested_amount_positive_chk" CHECK ("requested_amount" > 0)
);
CREATE INDEX "wallet_topup_requests_wallet_id_idx" ON "wallet_topup_requests" ("wallet_id");
CREATE INDEX "wallet_topup_requests_created_at_idx" ON "wallet_topup_requests" ("created_at");

INSERT INTO "customer_wallets" ("customer_identifier", "currency_code")
VALUES ('demo-wallet-customer', 'CLP');

INSERT INTO "wallet_ledger_entries" (
  "wallet_id",
  "entry_type",
  "amount_signed",
  "currency_code",
  "status",
  "reference_type",
  "reference_id",
  "external_reference",
  "note",
  "created_by_user_id",
  "created_by_role"
)
SELECT
  w."id",
  'topup_cashier'::"wallet_entry_type",
  25000,
  'CLP',
  'posted'::"wallet_entry_status",
  'cashier_topup'::"wallet_reference_type",
  'seed-cash-topup',
  'seed-cash-topup',
  'Saldo inicial demo cargado por caja.',
  'system',
  'owner'
FROM "customer_wallets" w
WHERE w."customer_identifier" = 'demo-wallet-customer';

INSERT INTO "wallet_ledger_entries" (
  "wallet_id",
  "entry_type",
  "amount_signed",
  "currency_code",
  "status",
  "reference_type",
  "reference_id",
  "external_reference",
  "note",
  "created_by_user_id",
  "created_by_role"
)
SELECT
  w."id",
  'admin_adjustment_credit'::"wallet_entry_type",
  1500,
  'CLP',
  'posted'::"wallet_entry_status",
  'admin_adjustment'::"wallet_reference_type",
  'seed-opening-credit',
  NULL,
  'Crédito operativo de apertura para demo.',
  'system',
  'owner'
FROM "customer_wallets" w
WHERE w."customer_identifier" = 'demo-wallet-customer';

INSERT INTO "wallet_topup_requests" (
  "wallet_id",
  "method",
  "requested_amount",
  "status",
  "submitted_reference",
  "note"
)
SELECT
  w."id",
  'transfer'::"wallet_topup_method",
  12000,
  'pending'::"wallet_topup_request_status",
  'TRX-DEMO-0001',
  'Transferencia demo pendiente de revisión manual.'
FROM "customer_wallets" w
WHERE w."customer_identifier" = 'demo-wallet-customer';
