import { z } from 'zod';

const nodeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const customerAuthEnvSchema = z.object({
  CUSTOMER_AUTH_SESSION_SECRET: z.string().min(1).optional(),
  CUSTOMER_AUTH_OTP_SECRET: z.string().min(1).optional(),
  CUSTOMER_AUTH_SMS_PROVIDER: z.enum(['console', 'twilio']).default('console'),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_FROM_PHONE_NUMBER: z.string().min(1).optional(),
});

const bootstrapEnvSchema = nodeEnvSchema.extend({
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
  ADMIN_BOOTSTRAP_NAME: z.string().min(1).optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
type CustomerAuthEnv = z.infer<typeof customerAuthEnvSchema>;
type BootstrapEnv = z.infer<typeof bootstrapEnvSchema>;
type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedDatabaseEnv: DatabaseEnv | null = null;
let cachedCustomerAuthEnv: CustomerAuthEnv | null = null;
let cachedBootstrapEnv: BootstrapEnv | null = null;
let cachedClientEnv: ClientEnv | null = null;

export function getDatabaseEnv(): DatabaseEnv {
  if (cachedDatabaseEnv) {
    return cachedDatabaseEnv;
  }

  cachedDatabaseEnv = databaseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });

  return cachedDatabaseEnv;
}

export function getCustomerAuthEnv(): CustomerAuthEnv {
  if (cachedCustomerAuthEnv) {
    return cachedCustomerAuthEnv;
  }

  cachedCustomerAuthEnv = customerAuthEnvSchema.parse({
    CUSTOMER_AUTH_SESSION_SECRET: process.env.CUSTOMER_AUTH_SESSION_SECRET,
    CUSTOMER_AUTH_OTP_SECRET: process.env.CUSTOMER_AUTH_OTP_SECRET,
    CUSTOMER_AUTH_SMS_PROVIDER: process.env.CUSTOMER_AUTH_SMS_PROVIDER,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_PHONE_NUMBER: process.env.TWILIO_FROM_PHONE_NUMBER,
  });

  return cachedCustomerAuthEnv;
}

export function getBootstrapEnv(): BootstrapEnv {
  if (cachedBootstrapEnv) {
    return cachedBootstrapEnv;
  }

  cachedBootstrapEnv = bootstrapEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    ADMIN_BOOTSTRAP_NAME: process.env.ADMIN_BOOTSTRAP_NAME,
  });

  return cachedBootstrapEnv;
}

export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  cachedClientEnv = clientEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  return cachedClientEnv;
}
