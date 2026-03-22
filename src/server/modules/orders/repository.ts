import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import {
  customerOrderFlags,
  customerWallets,
  menuItems,
  orderEvents,
  orderItems,
  orderNotifications,
  orders,
  storeMenuItems,
  storeOrderAheadSettings,
  stores,
  walletLedgerEntries,
  walletTopupRequests,
} from '@/server/db/schema';
import type {
  CreateOrderEventInput,
  CreateOrderInput,
  CreateOrderItemInput,
  ClaimInternalNotificationRetryInput,
  CreateOrderNotificationInput,
  CustomerOrderFlags,
  OrderDetail,
  OrderEventRecord,
  OrderItem,
  OrderNotificationRecord,
  OrderRecord,
  OrderRepository,
  OrderStatus,
  StoreOrderContext,
  StoreOrderMenuItem,
  UpdateOrderNotificationInput,
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

type OrderRow = {
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
};

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

function mapOrderEvent(row: typeof orderEvents.$inferSelect): OrderEventRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    eventType: row.eventType,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    metadataJson: (row.metadataJson as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapOrderNotification(row: typeof orderNotifications.$inferSelect): OrderNotificationRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    notificationType: row.notificationType,
    channel: row.channel,
    status: row.status,
    recipientCustomerIdentifier: row.recipientCustomerIdentifier,
    payloadJson: (row.payloadJson as Record<string, unknown> | null) ?? null,
    failureReason: row.failureReason,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCustomerFlags(row: typeof customerOrderFlags.$inferSelect): CustomerOrderFlags {
  return {
    customerIdentifier: row.customerIdentifier,
    noShowCount: row.noShowCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildOrderRecord(row: OrderRow, latestEvent: OrderEventRecord | null): OrderRecord {
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
    lastEvent: latestEvent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOrderRecord(detail: OrderDetail): OrderRecord {
  const { items: _items, events: _events, notifications: _notifications, ...order } = detail;
  return order;
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

  async function loadOrderEvents(orderIds: string[]) {
    if (orderIds.length === 0) {
      return [] as OrderEventRecord[];
    }

    const rows = await resolveDatabase()
      .select()
      .from(orderEvents)
      .where(inArray(orderEvents.orderId, orderIds))
      .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id));

    return rows.map(mapOrderEvent);
  }

  async function loadOrderNotifications(orderIds: string[]) {
    if (orderIds.length === 0) {
      return [] as OrderNotificationRecord[];
    }

    const rows = await resolveDatabase()
      .select()
      .from(orderNotifications)
      .where(inArray(orderNotifications.orderId, orderIds))
      .orderBy(desc(orderNotifications.createdAt), desc(orderNotifications.id));

    return rows.map(mapOrderNotification);
  }

  async function loadOrderDetailList(whereClause: any): Promise<OrderDetail[]> {
    const orderRows = (await loadOrderRows(whereClause)) as OrderRow[];
    const orderIds = orderRows.map((order) => order.id);
    const [items, events, notifications] = await Promise.all([
      loadOrderItems(orderIds),
      loadOrderEvents(orderIds),
      loadOrderNotifications(orderIds),
    ]);

    return orderRows.map((orderRow) => {
      const orderEventsForOrder = events.filter((event: OrderEventRecord) => event.orderId === orderRow.id);
      return {
        ...buildOrderRecord(orderRow, orderEventsForOrder[0] ?? null),
        items: items.filter((item: OrderItem) => item.orderId === orderRow.id),
        events: orderEventsForOrder,
        notifications: notifications.filter(
          (notification: OrderNotificationRecord) => notification.orderId === orderRow.id,
        ),
      };
    });
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
      const rows = await resolveDatabase()
        .insert(orders)
        .values({
          customerIdentifier: input.customerIdentifier,
          storeId: input.storeId,
          status: input.status,
          currencyCode: input.currencyCode,
          totalAmount: input.totalAmount,
          placedAt: new Date(input.placedAt),
        })
        .returning({ id: orders.id });

      const order = await this.getOrderById(rows[0].id);
      if (!order) {
        throw new Error('Order was created but could not be reloaded.');
      }

      return toOrderRecord(order);
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

    async listAdminOrders(storeCode, status?: OrderStatus) {
      return loadOrderDetailList(
        status ? and(eq(stores.code, storeCode), eq(orders.status, status)) : eq(stores.code, storeCode),
      );
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

      const rows = await resolveDatabase()
        .update(orders)
        .set(updateSet)
        .where(eq(orders.id, input.orderId))
        .returning({ id: orders.id });
      if (!rows[0]) {
        return null;
      }

      const order = await this.getOrderById(rows[0].id);
      return order ? toOrderRecord(order) : null;
    },

    async createOrderEvent(input: CreateOrderEventInput) {
      const rows = await resolveDatabase()
        .insert(orderEvents)
        .values({
          orderId: input.orderId,
          eventType: input.eventType,
          actorUserId: input.actorUserId ?? null,
          actorRole: input.actorRole ?? null,
          metadataJson: input.metadataJson ?? null,
          createdAt: new Date(input.createdAt),
        })
        .returning();

      return mapOrderEvent(rows[0]);
    },

    async createOrderNotification(input: CreateOrderNotificationInput) {
      const rows = await resolveDatabase()
        .insert(orderNotifications)
        .values({
          orderId: input.orderId,
          notificationType: input.notificationType,
          channel: input.channel,
          status: input.status,
          recipientCustomerIdentifier: input.recipientCustomerIdentifier ?? null,
          payloadJson: input.payloadJson ?? null,
          failureReason: input.failureReason ?? null,
          attemptCount: input.attemptCount ?? 0,
          createdAt: new Date(input.createdAt),
          processedAt: input.processedAt ? new Date(input.processedAt) : null,
          updatedAt: new Date(input.updatedAt ?? input.createdAt),
        })
        .returning();

      return mapOrderNotification(rows[0]);
    },

    async claimInternalNotificationRetry(input: ClaimInternalNotificationRetryInput) {
      const rows = await resolveDatabase()
        .update(orderNotifications)
        .set({
          status: 'pending',
          failureReason: null,
          processedAt: null,
          attemptCount: sql`${orderNotifications.attemptCount} + 1`,
          updatedAt: new Date(input.updatedAt),
        })
        .where(
          and(
            eq(orderNotifications.id, input.notificationId),
            eq(orderNotifications.orderId, input.orderId),
            eq(orderNotifications.channel, 'internal'),
            eq(orderNotifications.status, 'failed'),
          ),
        )
        .returning();

      return rows[0] ? mapOrderNotification(rows[0]) : null;
    },

    async updateOrderNotification(input: UpdateOrderNotificationInput) {
      const updateSet: Record<string, unknown> = {
        updatedAt: new Date(input.updatedAt),
      };

      if (input.status !== undefined) {
        updateSet.status = input.status;
      }
      if (input.payloadJson !== undefined) {
        updateSet.payloadJson = input.payloadJson;
      }
      if (input.failureReason !== undefined) {
        updateSet.failureReason = input.failureReason;
      }
      if (input.attemptCount !== undefined) {
        updateSet.attemptCount = input.attemptCount;
      }
      if (input.processedAt !== undefined) {
        updateSet.processedAt = input.processedAt ? new Date(input.processedAt) : null;
      }

      const rows = await resolveDatabase()
        .update(orderNotifications)
        .set(updateSet)
        .where(eq(orderNotifications.id, input.notificationId))
        .returning();

      return rows[0] ? mapOrderNotification(rows[0]) : null;
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
        const rows = await resolveDatabase()
          .insert(customerOrderFlags)
          .values({
            customerIdentifier,
            noShowCount: 1,
            updatedAt: now,
          })
          .returning();

        return mapCustomerFlags(rows[0]);
      }

      const rows = await resolveDatabase()
        .update(customerOrderFlags)
        .set({
          noShowCount: existing.noShowCount + 1,
          updatedAt: now,
        })
        .where(eq(customerOrderFlags.customerIdentifier, customerIdentifier))
        .returning();

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
        .where(
          and(eq(walletLedgerEntries.walletId, walletId), eq(walletLedgerEntries.status, 'posted')),
        );

      return Number(rows[0]?.balance ?? 0);
    },

    async listLedgerEntries(walletId: string) {
      const rows = await resolveDatabase()
        .select()
        .from(walletLedgerEntries)
        .where(eq(walletLedgerEntries.walletId, walletId))
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

    async runInTransaction<T>(callback: (repository: OrderRepository) => Promise<T>): Promise<T> {
      const db = resolveDatabase();
      if (typeof db.transaction !== 'function') {
        return callback(this);
      }

      return db.transaction(async (tx: any) => {
        const transactionalRepository = makeOrderRepository(tx);
        return callback(transactionalRepository);
      });
    },
  };
}

export const orderRepository = makeOrderRepository();
export { makeOrderRepository };
