import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { getBootstrapEnv } from '@/server/env';
import { staffUsers } from '@/server/db/schema';
import { hashPassword } from '@/server/modules/staff-auth/service';

export type BootstrapOwnerResult =
  | { created: true }
  | {
      created: false;
      reason: 'already_exists' | 'missing_env';
    };

export async function bootstrapOwnerIfNeeded(): Promise<BootstrapOwnerResult> {
  const owner = await getDb()
    .select({ id: staffUsers.id })
    .from(staffUsers)
    .where(eq(staffUsers.role, 'owner'))
    .limit(1);

  if (owner[0]) {
    return { created: false, reason: 'already_exists' };
  }

  const env = getBootstrapEnv();
  if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD || !env.ADMIN_BOOTSTRAP_NAME) {
    return { created: false, reason: 'missing_env' };
  }

  await getDb().insert(staffUsers).values({
    email: env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase(),
    name: env.ADMIN_BOOTSTRAP_NAME,
    role: 'owner',
    passwordHash: await hashPassword(env.ADMIN_BOOTSTRAP_PASSWORD),
    isActive: true,
  });

  return { created: true };
}
