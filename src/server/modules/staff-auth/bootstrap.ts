import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { getServerEnv } from '@/server/env';
import { staffUsers } from '@/server/db/schema';
import { hashPassword } from '@/server/modules/staff-auth/service';

let bootstrapAttempted = false;

export async function ensureBootstrapOwner(): Promise<void> {
  if (bootstrapAttempted) {
    return;
  }

  const owner = await getDb()
    .select({ id: staffUsers.id })
    .from(staffUsers)
    .where(eq(staffUsers.role, 'owner'))
    .limit(1);

  if (owner[0]) {
    bootstrapAttempted = true;
    return;
  }

  const env = getServerEnv();
  if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD || !env.ADMIN_BOOTSTRAP_NAME) {
    bootstrapAttempted = true;
    return;
  }

  await getDb().insert(staffUsers).values({
    email: env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase(),
    name: env.ADMIN_BOOTSTRAP_NAME,
    role: 'owner',
    passwordHash: await hashPassword(env.ADMIN_BOOTSTRAP_PASSWORD),
    isActive: true,
  });

  bootstrapAttempted = true;
}
