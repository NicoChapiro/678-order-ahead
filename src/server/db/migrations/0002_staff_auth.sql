CREATE TYPE "public"."staff_role" AS ENUM('owner', 'barista');

CREATE TABLE "staff_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL,
  "name" varchar(120) NOT NULL,
  "role" "staff_role" NOT NULL,
  "password_hash" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "staff_users_email_unique_idx" ON "staff_users" ("email");

CREATE TABLE "staff_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staff_user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "staff_sessions_staff_user_id_staff_users_id_fk"
    FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX "staff_sessions_token_hash_unique_idx" ON "staff_sessions" ("token_hash");
