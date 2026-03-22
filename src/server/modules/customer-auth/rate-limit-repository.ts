import { and, eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { customerAuthRateLimits } from '@/server/db/schema';

export type CustomerAuthRateLimitRecord = {
  id: string;
  action: string;
  scopeKey: string;
  hitCount: number;
  windowStartedAt: string;
  blockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAuthRateLimitRepository = {
  getRateLimitRecord(action: string, scopeKey: string): Promise<CustomerAuthRateLimitRecord | null>;
  saveRateLimitRecord(input: {
    action: string;
    scopeKey: string;
    hitCount: number;
    windowStartedAt: string;
    blockedUntil?: string | null;
    updatedAt: string;
  }): Promise<CustomerAuthRateLimitRecord>;
  clearRateLimitRecord(action: string, scopeKey: string): Promise<void>;
};

function mapRateLimitRecord(
  row: typeof customerAuthRateLimits.$inferSelect,
): CustomerAuthRateLimitRecord {
  return {
    id: row.id,
    action: row.action,
    scopeKey: row.scopeKey,
    hitCount: row.hitCount,
    windowStartedAt: row.windowStartedAt.toISOString(),
    blockedUntil: row.blockedUntil?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function makeCustomerAuthRateLimitRepository(
  database?: ReturnType<typeof getDb> | any,
): CustomerAuthRateLimitRepository {
  const resolveDatabase = () => database ?? getDb();

  return {
    async getRateLimitRecord(action, scopeKey) {
      const rows = await resolveDatabase()
        .select()
        .from(customerAuthRateLimits)
        .where(
          and(
            eq(customerAuthRateLimits.action, action),
            eq(customerAuthRateLimits.scopeKey, scopeKey),
          ),
        )
        .limit(1);

      return rows[0] ? mapRateLimitRecord(rows[0]) : null;
    },

    async saveRateLimitRecord(input) {
      const existing = await this.getRateLimitRecord(input.action, input.scopeKey);

      if (existing) {
        const rows = await resolveDatabase()
          .update(customerAuthRateLimits)
          .set({
            hitCount: input.hitCount,
            windowStartedAt: new Date(input.windowStartedAt),
            blockedUntil: input.blockedUntil ? new Date(input.blockedUntil) : null,
            updatedAt: new Date(input.updatedAt),
          })
          .where(
            and(
              eq(customerAuthRateLimits.action, input.action),
              eq(customerAuthRateLimits.scopeKey, input.scopeKey),
            ),
          )
          .returning();

        return mapRateLimitRecord(rows[0]);
      }

      const rows = await resolveDatabase()
        .insert(customerAuthRateLimits)
        .values({
          action: input.action,
          scopeKey: input.scopeKey,
          hitCount: input.hitCount,
          windowStartedAt: new Date(input.windowStartedAt),
          blockedUntil: input.blockedUntil ? new Date(input.blockedUntil) : null,
          updatedAt: new Date(input.updatedAt),
        })
        .returning();

      return mapRateLimitRecord(rows[0]);
    },

    async clearRateLimitRecord(action, scopeKey) {
      await resolveDatabase()
        .delete(customerAuthRateLimits)
        .where(
          and(
            eq(customerAuthRateLimits.action, action),
            eq(customerAuthRateLimits.scopeKey, scopeKey),
          ),
        );
    },
  };
}

export const customerAuthRateLimitRepository = makeCustomerAuthRateLimitRepository();
export { makeCustomerAuthRateLimitRepository };
