import {
  boolean,
  index,
  integer,
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
export const staffRoleEnum = pgEnum('staff_role', ['owner', 'barista']);
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
    perDayUniqueIdx: uniqueIndex('store_hours_store_weekday_unique_idx').on(
      table.storeId,
      table.weekday,
    ),
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

export const staffUsers = pgTable(
  'staff_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    role: staffRoleEnum('role').notNull(),
    passwordHash: text('password_hash').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailUniqueIdx: uniqueIndex('staff_users_email_unique_idx').on(table.email),
  }),
);

export const staffSessions = pgTable(
  'staff_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    staffUserId: uuid('staff_user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex('staff_sessions_token_hash_unique_idx').on(table.tokenHash),
  }),
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUniqueIdx: uniqueIndex('menu_items_code_unique_idx').on(table.code),
  }),
);

export const storeMenuItems = pgTable(
  'store_menu_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    priceAmount: integer('price_amount').notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).default('CLP').notNull(),
    isVisible: boolean('is_visible').default(true).notNull(),
    isInStock: boolean('is_in_stock').default(true).notNull(),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storeMenuItemUniqueIdx: uniqueIndex('store_menu_items_store_menu_item_unique_idx').on(
      table.storeId,
      table.menuItemId,
    ),
  }),
);


export const walletEntryTypeEnum = pgEnum('wallet_entry_type', [
  'topup_card',
  'topup_transfer',
  'topup_cashier',
  'topup_mercado_pago',
  'admin_adjustment_credit',
  'admin_adjustment_debit',
  'order_payment',
  'order_reversal',
]);
export const walletEntryStatusEnum = pgEnum('wallet_entry_status', ['posted', 'pending', 'cancelled']);
export const walletReferenceTypeEnum = pgEnum('wallet_reference_type', [
  'manual_topup',
  'cashier_topup',
  'admin_adjustment',
  'order',
]);
export const walletTopupMethodEnum = pgEnum('wallet_topup_method', [
  'card',
  'transfer',
  'cashier',
  'mercado_pago',
]);
export const walletTopupRequestStatusEnum = pgEnum('wallet_topup_request_status', [
  'pending',
  'approved',
  'rejected',
]);

export const customerWallets = pgTable(
  'customer_wallets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerIdentifier: varchar('customer_identifier', { length: 120 }).notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).default('CLP').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customerIdentifierUniqueIdx: uniqueIndex('customer_wallets_customer_identifier_unique_idx').on(
      table.customerIdentifier,
    ),
  }),
);

export const walletLedgerEntries = pgTable(
  'wallet_ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => customerWallets.id, { onDelete: 'cascade' }),
    entryType: walletEntryTypeEnum('entry_type').notNull(),
    amountSigned: integer('amount_signed').notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).default('CLP').notNull(),
    status: walletEntryStatusEnum('status').default('posted').notNull(),
    referenceType: walletReferenceTypeEnum('reference_type'),
    referenceId: varchar('reference_id', { length: 120 }),
    externalReference: varchar('external_reference', { length: 191 }),
    note: text('note'),
    createdByUserId: varchar('created_by_user_id', { length: 64 }),
    createdByRole: varchar('created_by_role', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    walletIdIdx: index('wallet_ledger_entries_wallet_id_idx').on(table.walletId),
    createdAtIdx: index('wallet_ledger_entries_created_at_idx').on(table.createdAt),
    walletCreatedAtIdx: index('wallet_ledger_entries_wallet_id_created_at_idx').on(
      table.walletId,
      table.createdAt,
    ),
  }),
);

export const walletTopupRequests = pgTable(
  'wallet_topup_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => customerWallets.id, { onDelete: 'cascade' }),
    method: walletTopupMethodEnum('method').notNull(),
    requestedAmount: integer('requested_amount').notNull(),
    status: walletTopupRequestStatusEnum('status').default('pending').notNull(),
    submittedReference: varchar('submitted_reference', { length: 191 }),
    reviewedByUserId: varchar('reviewed_by_user_id', { length: 64 }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    walletIdIdx: index('wallet_topup_requests_wallet_id_idx').on(table.walletId),
    createdAtIdx: index('wallet_topup_requests_created_at_idx').on(table.createdAt),
  }),
);
