import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import {
  customerOrderFlags,
  customerWallets,
  menuItems,
  orderItems,
  orders,
  storeMenuItems,
  storeOrderAheadSettings,
  stores,
  walletLedgerEntries,
  walletTopupRequests,
} from '@/server/db/schema';
import type {
  CreateOrderInput,
  CreateOrderItemInput,
  CustomerOrderFlags,
  OrderDetail,
  OrderItem,
  OrderRecord,
  OrderRepository,
  StoreOrderContext,
  StoreOrderMenuItem,
  UpdateOrderStatusInput,
} from '@/server/modules/orders/types';
import type {
  CreateLedgerEntryInput,
  CreateTopupRequestInput,
  CreateWalletInput,
  CustomerWallet,
  ReviewTopupRequestInput,
  WalletActorRole,
  WalletCurrencyCode,
  WalletLedgerEntry,
  WalletTopupRequest,
} from '@/server/modules/wallet/types';

function mapWallet(row: typeof customerWallets.$inferSelect): CustomerWallet {
  return {
    id: row.id,
    customerIdentifier: row.customerIdentifier,
    currencyCode: row.currencyCode as WalletCurrencyCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapLedgerEntry(row: typeof walletLedgerEntries.$inferSelect): WalletLedgerEntry {
  return {
    id: row.id,
    walletId: row.walletId,
    entryType: row.entryType,
    amountSigned: row.amountSigned,
    currencyCode: row.currencyCode as WalletCurrencyCode,
    status: row.status,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    externalReference: row.externalReference,
    note: row.note,
    createdByUserId: row.createdByUserId,
    createdByRole: row.createdByRole as WalletActorRole | null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapTopupRequest(row: typeof walletTopupRequests.$inferSelect): WalletTopupRequest {
  return {
    id: row.id,
    walletId: row.walletId,
    method: row.method,
    requestedAmount: row.requestedAmount,
    status: row.status,
    submittedReference: row.submittedReference,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapOrder(row: {
  id: string;
  customerIdentifier: string;
  storeId: string;
  storeCode: typeof stores.$inferSelect.code;
  storeName: string;
  status: typeof orders.$inferSelect.status;
  currencyCode: string;
  totalAmount: number;
  placedAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  readyAt: Date | null;
  completedAt: Date | null;
  noShowAt: Date | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): OrderRecord {
  return {
    id: row.id,
    customerIdentifier: row.customerIdentifier,
    storeId: row.storeId,
    storeCode: row.storeCode,
    storeName: row.storeName,
    status: row.status,
    currencyCode: row.currencyCode as 'CLP',
    totalAmount: row.totalAmount,
    placedAt: row.placedAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    readyAt: row.readyAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    noShowAt: row.noShowAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapOrderItem(row: typeof orderItems.$inferSelect): OrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    menuItemId: row.menuItemId,
    storeMenuItemId: row.storeMenuItemId,
    itemNameSnapshot: row.itemNameSnapshot,
    unitPriceAmount: row.unitPriceAmount,
    quantity: row.quantity,
    lineTotalAmount: row.lineTotalAmount,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCustomerFlags(row: typeof customerOrderFlags.$inferSelect): CustomerOrderFlags {
  return {
    customerIdentifier: row.customerIdentifier,
    noShowCount: row.noShowCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function makeOrderRepository(database?: ReturnType<typeof getDb> | any): OrderRepository {
  const resolveDatabase = () => database ?? getDb();

  async function loadOrderRows(whereClause: any) {
    return resolveDatabase()
      .select({
        id: orders.id,
        customerIdentifier: orders.customerIdentifier,
        storeId: orders.storeId,
        storeCode: stores.code,
        storeName: stores.name,
        status: orders.status,
        currencyCode: orders.currencyCode,
        totalAmount: orders.totalAmount,
        placedAt: orders.placedAt,
        acceptedAt: orders.acceptedAt,
        rejectedAt: orders.rejectedAt,
        cancelledAt: orders.cancelledAt,
        readyAt: orders.readyAt,
        completedAt: orders.completedAt,
        noShowAt: orders.noShowAt,
        rejectionReason: orders.rejectionReason,
        cancellationReason: orders.cancellationReason,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .innerJoin(stores, eq(stores.id, orders.storeId))
      .where(whereClause)
      .orderBy(desc(orders.createdAt), desc(orders.id));
  }

  async function loadOrderItems(orderIds: string[]) {
    if (orderIds.length === 0) {
      return [] as OrderItem[];
    }

    const rows = await resolveDatabase()
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .orderBy(desc(orderItems.createdAt), desc(orderItems.id));

    return rows.map(mapOrderItem);
  }

  async function loadOrderDetailList(whereClause: any): Promise<OrderDetail[]> {
    const orderRows = await loadOrderRows(whereClause);
    const mappedOrders: OrderRecord[] = orderRows.map(mapOrder);
    const items: OrderItem[] = await loadOrderItems(mappedOrders.map((order: OrderRecord) => order.id));

    return mappedOrders.map((order: OrderRecord) => ({
      ...order,
      items: items.filter((item: OrderItem) => item.orderId === order.id),
    }));
  }

  return {
    async getStoreOrderContext(storeCode) {
      const rows = await resolveDatabase()
        .select({
          storeId: stores.id,
          storeCode: stores.code,
          storeName: stores.name,
          isOrderAheadEnabled: sql<boolean>`COALESCE(${storeOrderAheadSettings.isEnabled}, true)`,
        })
        .from(stores)
        .leftJoin(storeOrderAheadSettings, eq(storeOrderAheadSettings.storeId, stores.id))
        .where(eq(stores.code, storeCode))
        .limit(1);

      return (rows[0] as StoreOrderContext | undefined) ?? null;
    },

    async listStoreOrderMenuItems(storeCode, menuItemIds) {
      if (menuItemIds.length === 0) {
        return [];
      }

      const rows = await resolveDatabase()
        .select({
          storeId: stores.id,
          storeCode: stores.code,
          storeMenuItemId: storeMenuItems.id,
          menuItemId: storeMenuItems.menuItemId,
          itemName: menuItems.name,
          priceAmount: storeMenuItems.priceAmount,
          currencyCode: storeMenuItems.currencyCode,
          isVisible: storeMenuItems.isVisible,
          isInStock: storeMenuItems.isInStock,
          baseIsActive: menuItems.isActive,
        })
        .from(storeMenuItems)
        .innerJoin(stores, eq(stores.id, storeMenuItems.storeId))
        .innerJoin(menuItems, eq(menuItems.id, storeMenuItems.menuItemId))
        .where(and(eq(stores.code, storeCode), inArray(storeMenuItems.menuItemId, menuItemIds)));

      return rows as StoreOrderMenuItem[];
    },

    async createOrder(input: CreateOrderInput) {
      const rows = await resolveDatabase().insert(orders).values({
        customerIdentifier: input.customerIdentifier,
        storeId: input.storeId,
        status: input.status,
        currencyCode: input.currencyCode,
        totalAmount: input.totalAmount,
        placedAt: new Date(input.placedAt),
      }).returning();

      return (await loadOrderDetailList(eq(orders.id, rows[0].id)))[0];
    },

    async createOrderItems(itemsInput: CreateOrderItemInput[]) {
      if (itemsInput.length === 0) {
        return [];
      }

      const rows = await resolveDatabase().insert(orderItems).values(itemsInput).returning();
      return rows.map(mapOrderItem);
    },

    async getOrderById(orderId) {
      return (await loadOrderDetailList(eq(orders.id, orderId)))[0] ?? null;
    },

    async listCustomerOrders(customerIdentifier) {
      return loadOrderDetailList(eq(orders.customerIdentifier, customerIdentifier));
    },

    async listAdminOrders(storeCode) {
      return loadOrderDetailList(eq(stores.code, storeCode));
    },

    async updateOrderStatus(input: UpdateOrderStatusInput) {
      const actedAt = new Date(input.actedAt);
      const updateSet: Record<string, Date | string | null> = {
        status: input.status,
        updatedAt: actedAt,
      };

      if (input.status === 'accepted') {
        updateSet.acceptedAt = actedAt;
      }
      if (input.status === 'rejected') {
        updateSet.rejectedAt = actedAt;
        updateSet.rejectionReason = input.rejectionReason ?? null;
      }
      if (input.status === 'cancelled_by_customer') {
        updateSet.cancelledAt = actedAt;
        updateSet.cancellationReason = input.cancellationReason ?? null;
      }
      if (input.status === 'ready_for_pickup') {
        updateSet.readyAt = actedAt;
      }
      if (input.status === 'completed') {
        updateSet.completedAt = actedAt;
      }
      if (input.status === 'no_show') {
        updateSet.noShowAt = actedAt;
      }

      const rows = await resolveDatabase().update(orders).set(updateSet).where(eq(orders.id, input.orderId)).returning({ id: orders.id });
      if (!rows[0]) {
        return null;
      }

      const order = await this.getOrderById(rows[0].id);
      return order;
    },

    async getCustomerOrderFlags(customerIdentifier) {
      const rows = await resolveDatabase()
        .select()
        .from(customerOrderFlags)
        .where(eq(customerOrderFlags.customerIdentifier, customerIdentifier))
        .limit(1);

      return rows[0] ? mapCustomerFlags(rows[0]) : null;
    },

    async incrementCustomerNoShowCount(customerIdentifier, actedAt) {
      const now = new Date(actedAt);
      const existing = await this.getCustomerOrderFlags(customerIdentifier);

      if (!existing) {
        const rows = await resolveDatabase().insert(customerOrderFlags).values({
          customerIdentifier,
          noShowCount: 1,
          updatedAt: now,
        }).returning();

        return mapCustomerFlags(rows[0]);
      }

      const rows = await resolveDatabase().update(customerOrderFlags).set({
        noShowCount: existing.noShowCount + 1,
        updatedAt: now,
      }).where(eq(customerOrderFlags.customerIdentifier, customerIdentifier)).returning();

      return mapCustomerFlags(rows[0]);
    },

    async findWalletByCustomerIdentifier(customerIdentifier) {
      const rows = await resolveDatabase()
        .select()
        .from(customerWallets)
        .where(eq(customerWallets.customerIdentifier, customerIdentifier))
        .limit(1);

      return rows[0] ? mapWallet(rows[0]) : null;
    },

    async createWallet(input: CreateWalletInput) {
      try {
        const rows = await resolveDatabase().insert(customerWallets).values(input).returning();
        return mapWallet(rows[0]);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('customer_wallets_customer_identifier_unique_idx')
        ) {
          const existing = await this.findWalletByCustomerIdentifier(input.customerIdentifier);
          if (existing) {
            return existing;
          }
        }

        throw error;
      }
    },

    async getPostedBalance(walletId: string) {
      const rows = await resolveDatabase()
        .select({ balance: sql<number>`COALESCE(SUM(${walletLedgerEntries.amountSigned}), 0)` })
        .from(walletLedgerEntries)
        .where(and(eq(walletLedgerEntries.walletId, walletId), eq(walletLedgerEntries.status, 'posted')));

      return Number(rows[0]?.balance ?? 0);
    },

    async listLedgerEntries(walletId: string) {
      const rows = await resolveDatabase().select().from(walletLedgerEntries).where(eq(walletLedgerEntries.walletId, walletId)).orderBy(desc(walletLedgerEntries.createdAt), desc(walletLedgerEntries.id));
      return rows.map(mapLedgerEntry);
    },

    async listReferenceEntries(walletId, referenceType, referenceId) {
      const rows = await resolveDatabase()
        .select()
        .from(walletLedgerEntries)
        .where(
          and(
            eq(walletLedgerEntries.walletId, walletId),
            eq(walletLedgerEntries.referenceType, referenceType),
            eq(walletLedgerEntries.referenceId, referenceId),
          ),
        )
        .orderBy(desc(walletLedgerEntries.createdAt), desc(walletLedgerEntries.id));

      return rows.map(mapLedgerEntry);
    },

    async createLedgerEntry(input: CreateLedgerEntryInput) {
      const rows = await resolveDatabase().insert(walletLedgerEntries).values(input).returning();
      return mapLedgerEntry(rows[0]);
    },

    async createTopupRequest(input: CreateTopupRequestInput) {
      const rows = await resolveDatabase().insert(walletTopupRequests).values(input).returning();
      return mapTopupRequest(rows[0]);
    },

    async getTopupRequestById(topupRequestId: string) {
      const rows = await resolveDatabase()
        .select()
        .from(walletTopupRequests)
        .where(eq(walletTopupRequests.id, topupRequestId))
        .limit(1);

      return rows[0] ? mapTopupRequest(rows[0]) : null;
    },

    async reviewTopupRequest(input: ReviewTopupRequestInput) {
      const rows = await resolveDatabase()
        .update(walletTopupRequests)
        .set({
          status: input.status,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(input.reviewedAt),
          note: input.note ?? null,
          updatedAt: new Date(input.reviewedAt),
        })
        .where(eq(walletTopupRequests.id, input.topupRequestId))
        .returning();

      return rows[0] ? mapTopupRequest(rows[0]) : null;
    },

    async runInTransaction<T>(callback: (repository: OrderRepository) => Promise<T>): Promise<T> {
      return resolveDatabase().transaction(async (tx: ReturnType<typeof getDb> | any) => {
        return callback(makeOrderRepository(tx));
      });
    },
  };
}

export const orderRepository = makeOrderRepository();
