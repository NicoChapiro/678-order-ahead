import { z } from 'zod';

const nodeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const customerPhoneAuthEnvSchema = z.object({
  PHONE_AUTH_PROVIDER: z.string().min(1),
  PHONE_AUTH_API_KEY: z.string().min(1),
});

const internalSecurityEnvSchema = z.object({
  INTERNAL_API_SECRET: z.string().min(1),
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
type CustomerPhoneAuthEnv = z.infer<typeof customerPhoneAuthEnvSchema>;
type InternalSecurityEnv = z.infer<typeof internalSecurityEnvSchema>;
type BootstrapEnv = z.infer<typeof bootstrapEnvSchema>;
type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedDatabaseEnv: DatabaseEnv | null = null;
let cachedCustomerPhoneAuthEnv: CustomerPhoneAuthEnv | null = null;
let cachedInternalSecurityEnv: InternalSecurityEnv | null = null;
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

export function getCustomerPhoneAuthEnv(): CustomerPhoneAuthEnv {
  if (cachedCustomerPhoneAuthEnv) {
    return cachedCustomerPhoneAuthEnv;
  }

  cachedCustomerPhoneAuthEnv = customerPhoneAuthEnvSchema.parse({
    PHONE_AUTH_PROVIDER: process.env.PHONE_AUTH_PROVIDER,
    PHONE_AUTH_API_KEY: process.env.PHONE_AUTH_API_KEY,
  });

  return cachedCustomerPhoneAuthEnv;
}

export function getInternalSecurityEnv(): InternalSecurityEnv {
  if (cachedInternalSecurityEnv) {
    return cachedInternalSecurityEnv;
  }

  cachedInternalSecurityEnv = internalSecurityEnvSchema.parse({
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
  });

  return cachedInternalSecurityEnv;
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
