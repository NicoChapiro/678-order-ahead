import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import {
  customerOtpChallenges,
  customerSessions,
  customers,
} from '@/server/db/schema';
import type {
  AuthenticatedCustomerSession,
  CreateCustomerInput,
  CreateCustomerOtpChallengeInput,
  CreateCustomerSessionInput,
  CustomerAuthRepository,
  CustomerOtpChallenge,
  CustomerRecord,
  CustomerSessionRecord,
} from '@/server/modules/customer-auth/types';

function mapCustomer(row: typeof customers.$inferSelect): CustomerRecord {
  return {
    id: row.id,
    phoneNumber: row.phoneNumber,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapOtpChallenge(row: typeof customerOtpChallenges.$inferSelect): CustomerOtpChallenge {
  return {
    id: row.id,
    customerId: row.customerId,
    phoneNumber: row.phoneNumber,
    codeHash: row.codeHash,
    expiresAt: row.expiresAt.toISOString(),
    consumedAt: row.consumedAt?.toISOString() ?? null,
    invalidatedAt: row.invalidatedAt?.toISOString() ?? null,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSession(row: typeof customerSessions.$inferSelect): CustomerSessionRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function makeCustomerAuthRepository(database?: ReturnType<typeof getDb> | any): CustomerAuthRepository {
  const resolveDatabase = () => database ?? getDb();

  return {
    async findCustomerById(customerId) {
      const rows = await resolveDatabase()
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);

      return rows[0] ? mapCustomer(rows[0]) : null;
    },

    async findCustomerByPhoneNumber(phoneNumber) {
      const rows = await resolveDatabase()
        .select()
        .from(customers)
        .where(eq(customers.phoneNumber, phoneNumber))
        .limit(1);

      return rows[0] ? mapCustomer(rows[0]) : null;
    },

    async createCustomer(input: CreateCustomerInput) {
      try {
        const rows = await resolveDatabase().insert(customers).values(input).returning();
        return mapCustomer(rows[0]);
      } catch (error) {
        if (error instanceof Error && error.message.includes('customers_phone_number_unique_idx')) {
          const existing = await this.findCustomerByPhoneNumber(input.phoneNumber);
          if (existing) {
            return existing;
          }
        }

        throw error;
      }
    },

    async createOtpChallenge(input: CreateCustomerOtpChallengeInput) {
      const rows = await resolveDatabase()
        .insert(customerOtpChallenges)
        .values({
          customerId: input.customerId,
          phoneNumber: input.phoneNumber,
          codeHash: input.codeHash,
          expiresAt: new Date(input.expiresAt),
          createdAt: new Date(input.createdAt),
        })
        .returning();

      return mapOtpChallenge(rows[0]);
    },

    async findLatestOtpChallengeByPhoneNumber(phoneNumber) {
      const rows = await resolveDatabase()
        .select()
        .from(customerOtpChallenges)
        .where(
          and(
            eq(customerOtpChallenges.phoneNumber, phoneNumber),
            isNull(customerOtpChallenges.consumedAt),
            isNull(customerOtpChallenges.invalidatedAt),
          ),
        )
        .orderBy(desc(customerOtpChallenges.createdAt), desc(customerOtpChallenges.id))
        .limit(1);

      return rows[0] ? mapOtpChallenge(rows[0]) : null;
    },

    async incrementOtpChallengeAttempt(input) {
      const rows = await resolveDatabase()
        .update(customerOtpChallenges)
        .set({
          attemptCount: sql`${customerOtpChallenges.attemptCount} + 1`,
          lastAttemptAt: new Date(input.attemptedAt),
        })
        .where(eq(customerOtpChallenges.id, input.challengeId))
        .returning();

      return rows[0] ? mapOtpChallenge(rows[0]) : null;
    },

    async invalidateOtpChallengesForCustomer(customerId, invalidatedAt) {
      await resolveDatabase()
        .update(customerOtpChallenges)
        .set({
          invalidatedAt: new Date(invalidatedAt),
        })
        .where(
          and(
            eq(customerOtpChallenges.customerId, customerId),
            isNull(customerOtpChallenges.consumedAt),
            isNull(customerOtpChallenges.invalidatedAt),
          ),
        );
    },

    async consumeOtpChallenge(input) {
      const rows = await resolveDatabase()
        .update(customerOtpChallenges)
        .set({
          consumedAt: new Date(input.consumedAt),
        })
        .where(eq(customerOtpChallenges.id, input.challengeId))
        .returning();

      return rows[0] ? mapOtpChallenge(rows[0]) : null;
    },

    async createSession(input: CreateCustomerSessionInput) {
      const rows = await resolveDatabase()
        .insert(customerSessions)
        .values({
          customerId: input.customerId,
          tokenHash: input.tokenHash,
          expiresAt: new Date(input.expiresAt),
          lastSeenAt: input.lastSeenAt ? new Date(input.lastSeenAt) : null,
          createdAt: new Date(input.createdAt),
        })
        .returning();

      return mapSession(rows[0]);
    },

    async findAuthenticatedSessionByTokenHash(tokenHash) {
      const rows = await resolveDatabase()
        .select({
          session: customerSessions,
          customer: customers,
        })
        .from(customerSessions)
        .innerJoin(customers, eq(customers.id, customerSessions.customerId))
        .where(eq(customerSessions.tokenHash, tokenHash))
        .limit(1);

      const row = rows[0];
      if (!row) {
        return null;
      }

      return {
        session: mapSession(row.session),
        customer: mapCustomer(row.customer),
      } satisfies AuthenticatedCustomerSession;
    },

    async touchSession(input) {
      const rows = await resolveDatabase()
        .update(customerSessions)
        .set({
          lastSeenAt: new Date(input.seenAt),
        })
        .where(eq(customerSessions.id, input.sessionId))
        .returning();

      return rows[0] ? mapSession(rows[0]) : null;
    },

    async revokeSessionByTokenHash(tokenHash, revokedAt) {
      await resolveDatabase()
        .update(customerSessions)
        .set({
          revokedAt: new Date(revokedAt),
        })
        .where(eq(customerSessions.tokenHash, tokenHash));
    },
  };
}

export const customerAuthRepository = makeCustomerAuthRepository();
export { makeCustomerAuthRepository };
