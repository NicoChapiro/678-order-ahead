import { and, eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { staffUsers } from '@/server/db/schema';
import { createStaffSession, verifyPassword } from '@/server/modules/staff-auth/service';

export class StaffLoginError extends Error {}

export async function loginStaffUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const rows = await getDb()
    .select({
      id: staffUsers.id,
      email: staffUsers.email,
      name: staffUsers.name,
      role: staffUsers.role,
      passwordHash: staffUsers.passwordHash,
      isActive: staffUsers.isActive,
    })
    .from(staffUsers)
    .where(and(eq(staffUsers.email, normalizedEmail), eq(staffUsers.isActive, true)))
    .limit(1);

  const staffUser = rows[0];
  if (!staffUser) {
    throw new StaffLoginError('Invalid credentials.');
  }

  const validPassword = await verifyPassword(password, staffUser.passwordHash);
  if (!validPassword) {
    throw new StaffLoginError('Invalid credentials.');
  }

  const session = await createStaffSession(staffUser.id);

  return {
    user: {
      id: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,
    },
    session,
  };
}
