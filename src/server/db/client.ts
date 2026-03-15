import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { serverEnv } from '@/server/env';

const queryClient = postgres(serverEnv.DATABASE_URL, {
  prepare: false,
});

export const db = drizzle(queryClient);
