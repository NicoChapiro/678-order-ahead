CREATE TABLE IF NOT EXISTS "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone_number" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_number_unique_idx"
  ON "customers" ("phone_number");

CREATE TABLE IF NOT EXISTS "customer_otp_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
  "phone_number" varchar(32) NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "invalidated_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "customer_otp_challenges_customer_id_idx"
  ON "customer_otp_challenges" ("customer_id");

CREATE INDEX IF NOT EXISTS "customer_otp_challenges_phone_number_created_at_idx"
  ON "customer_otp_challenges" ("phone_number", "created_at");

CREATE TABLE IF NOT EXISTS "customer_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_seen_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "customer_sessions_customer_id_idx"
  ON "customer_sessions" ("customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_sessions_token_hash_unique_idx"
  ON "customer_sessions" ("token_hash");
