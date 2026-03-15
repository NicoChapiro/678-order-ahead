import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { staffSessions, staffUsers } from '@/server/db/schema';

const scrypt = promisify(scryptCallback);
const STAFF_SESSION_COOKIE_NAME = 'staff_session';
const STAFF_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

type CookieReader = {
  cookies: {
    get(name: string): { value: string } | undefined;
  };
};

export class StaffAuthError extends Error {}

export type StaffSessionActor = {
  staffUserId: string;
  email: string;
  name: string;
  role: 'owner' | 'barista';
  sessionId: string;
  expiresAt: Date;
};

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [salt, expectedHash] = passwordHash.split(':');
  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (actualHash.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedBuffer);
}

export async function createStaffSession(staffUserId: string) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + STAFF_SESSION_TTL_MS);

  await getDb().insert(staffSessions).values({
    staffUserId,
    tokenHash,
    expiresAt,
  });

  return {
    token,
    expiresAt,
  };
}

export async function invalidateStaffSession(sessionToken: string): Promise<void> {
  await getDb()
    .update(staffSessions)
    .set({ revokedAt: new Date() })
    .where(eq(staffSessions.tokenHash, hashSessionToken(sessionToken)));
}

export async function getOptionalStaffSession(request: CookieReader): Promise<StaffSessionActor | null> {
  const token = request.cookies.get(STAFF_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const rows = await getDb()
    .select({
      sessionId: staffSessions.id,
      expiresAt: staffSessions.expiresAt,
      staffUserId: staffUsers.id,
      email: staffUsers.email,
      name: staffUsers.name,
      role: staffUsers.role,
      isActive: staffUsers.isActive,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffUsers.id, staffSessions.staffUserId))
    .where(
      and(
        eq(staffSessions.tokenHash, hashSessionToken(token)),
        isNull(staffSessions.revokedAt),
        gt(staffSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || !row.isActive) {
    return null;
  }

  return {
    staffUserId: row.staffUserId,
    email: row.email,
    name: row.name,
    role: row.role,
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
  };
}

export async function getRequiredStaffSession(request: CookieReader): Promise<StaffSessionActor> {
  const session = await getOptionalStaffSession(request);
  if (!session) {
    throw new StaffAuthError('Authentication required.');
  }

  return session;
}

export function getStaffSessionCookieName() {
  return STAFF_SESSION_COOKIE_NAME;
}
