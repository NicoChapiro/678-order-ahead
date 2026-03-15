import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Foundation tables only. Business modules will be introduced incrementally.
 */
export const healthcheck = pgTable('healthcheck', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
