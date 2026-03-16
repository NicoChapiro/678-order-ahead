import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseEnv } from '@/server/env';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const env = getDatabaseEnv();
  const queryClient = postgres(env.DATABASE_URL, {
    prepare: false,
  });

  dbInstance = drizzle(queryClient);
  return dbInstance;
}
