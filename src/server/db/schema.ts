import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Foundation tables only. Business modules will be introduced incrementally.
 */
export const healthcheck = pgTable('healthcheck', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const storeCodeEnum = pgEnum('store_code', ['store_1', 'store_2', 'store_3']);
export const weekdayEnum = pgEnum('weekday', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export const orderAheadReasonCodeEnum = pgEnum('order_ahead_reason_code', [
  'manual_pause',
  'equipment_issue',
  'staffing_issue',
  'inventory_issue',
  'system_issue',
  'other',
]);

export const stores = pgTable(
  'stores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: storeCodeEnum('code').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUniqueIdx: uniqueIndex('stores_code_unique_idx').on(table.code),
  }),
);

export const storeHours = pgTable(
  'store_hours',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    weekday: weekdayEnum('weekday').notNull(),
    openTime: varchar('open_time', { length: 5 }).notNull(),
    closeTime: varchar('close_time', { length: 5 }).notNull(),
    isClosed: boolean('is_closed').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    perDayUniqueIdx: uniqueIndex('store_hours_store_weekday_unique_idx').on(table.storeId, table.weekday),
  }),
);

export const storeOrderAheadSettings = pgTable(
  'store_order_ahead_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    disabledReasonCode: orderAheadReasonCodeEnum('disabled_reason_code'),
    disabledComment: text('disabled_comment'),
    updatedByUserId: varchar('updated_by_user_id', { length: 64 }).notNull(),
    updatedByRole: varchar('updated_by_role', { length: 32 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storeUniqueIdx: uniqueIndex('store_order_ahead_settings_store_unique_idx').on(table.storeId),
  }),
);

export const storeOrderAheadEvents = pgTable('store_order_ahead_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  storeId: uuid('store_id')
    .notNull()
    .references(() => stores.id, { onDelete: 'cascade' }),
  newIsEnabled: boolean('new_is_enabled').notNull(),
  reasonCode: orderAheadReasonCodeEnum('reason_code'),
  comment: text('comment'),
  changedByUserId: varchar('changed_by_user_id', { length: 64 }).notNull(),
  changedByRole: varchar('changed_by_role', { length: 32 }).notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
});
