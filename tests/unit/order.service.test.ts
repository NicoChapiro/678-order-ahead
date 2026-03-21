import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptOrder,
  cancelOrderByCustomer,
  CancellationWindowExpiredError,
  completeOrder,
  createOrder,
  InvalidOrderStateTransitionError,
  markOrderNoShow,
  markOrderReadyForPickup,
  MenuItemUnavailableError,
  OrderAheadUnavailableError,
  OrderInsufficientFundsError,
  OrderValidationError,
  rejectOrder,
} from '@/server/modules/orders/service';
import type {
  CreateOrderEventInput,
  CreateOrderInput,
  CreateOrderItemInput,
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
  UpdateOrderStatusInput,
} from '@/server/modules/orders/types';
import type {
  CreateLedgerEntryInput,
  CreateTopupRequestInput,
  CreateWalletInput,
  CustomerWallet,
  ReviewTopupRequestInput,
  WalletLedgerEntry,
  WalletReferenceType,
  WalletTopupRequest,
} from '@/server/modules/wallet/types';

class InMemoryOrderRepository implements OrderRepository {
  walletSeq = 1;
  orderSeq = 1;
  orderItemSeq = 1;
  ledgerSeq = 1;
  eventSeq = 1;
  notificationSeq = 1;
  tick = 0;

  stores: StoreOrderContext[] = [
    {
      storeId: 'store-id-1',
      storeCode: 'store_1',
      storeName: 'Store 1',
      isOrderAheadEnabled: true,
    },
  ];

  storeMenuItems: StoreOrderMenuItem[] = [
    {
      storeId: 'store-id-1',
      storeCode: 'store_1',
      storeMenuItemId: 'smi-1',
      menuItemId: 'menu-1',
      itemName: 'Espresso',
      priceAmount: 1800,
      currencyCode: 'CLP',
      isVisible: true,
      isInStock: true,
      baseIsActive: true,
    },
    {
      storeId: 'store-id-1',
      storeCode: 'store_1',
      storeMenuItemId: 'smi-2',
      menuItemId: 'menu-2',
      itemName: 'Latte',
      priceAmount: 2600,
      currencyCode: 'CLP',
      isVisible: true,
      isInStock: true,
      baseIsActive: true,
    },
  ];

  wallets: CustomerWallet[] = [];
  ledgerEntries: WalletLedgerEntry[] = [];
  orders: OrderRecord[] = [];
  orderItems: OrderItem[] = [];
  orderEvents: OrderEventRecord[] = [];
  orderNotifications: OrderNotificationRecord[] = [];
  customerFlags: CustomerOrderFlags[] = [];
  topupRequests: WalletTopupRequest[] = [];

  private nextDate() {
    this.tick += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, this.tick)).toISOString();
  }

  private attachOrder(order: OrderRecord): OrderDetail {
    const events = this.orderEvents
      .filter((event) => event.orderId === order.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const notifications = this.orderNotifications
      .filter((notification) => notification.orderId === order.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      ...order,
      lastEvent: events[0] ?? null,
      items: this.orderItems.filter((item) => item.orderId === order.id),
      events,
      notifications,
    };
  }

  async getStoreOrderContext(storeCode: 'store_1' | 'store_2' | 'store_3') {
    return this.stores.find((store) => store.storeCode === storeCode) ?? null;
  }

  async listStoreOrderMenuItems(storeCode: 'store_1' | 'store_2' | 'store_3', menuItemIds: string[]) {
    return this.storeMenuItems.filter(
      (item) => item.storeCode === storeCode && menuItemIds.includes(item.menuItemId),
    );
  }

  async createOrder(input: CreateOrderInput) {
    const store = this.stores.find((entry) => entry.storeId === input.storeId)!;
    const now = input.placedAt;
    const order: OrderRecord = {
      id: `order-${this.orderSeq++}`,
      customerIdentifier: input.customerIdentifier,
      storeId: input.storeId,
      storeCode: store.storeCode,
      storeName: store.storeName,
      status: input.status,
      currencyCode: input.currencyCode,
      totalAmount: input.totalAmount,
      placedAt: now,
      acceptedAt: null,
      rejectedAt: null,
      cancelledAt: null,
      readyAt: null,
      completedAt: null,
      noShowAt: null,
      rejectionReason: null,
      cancellationReason: null,
      lastEvent: null,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.push(order);
    return order;
  }

  async createOrderItems(items: CreateOrderItemInput[]) {
    const created = items.map((item) => ({
      id: `order-item-${this.orderItemSeq++}`,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      storeMenuItemId: item.storeMenuItemId,
      itemNameSnapshot: item.itemNameSnapshot,
      unitPriceAmount: item.unitPriceAmount,
      quantity: item.quantity,
      lineTotalAmount: item.lineTotalAmount,
      createdAt: this.nextDate(),
    }));
    this.orderItems.push(...created);
    return created;
  }

  async getOrderById(orderId: string) {
    const order = this.orders.find((entry) => entry.id === orderId) ?? null;
    return order ? this.attachOrder(order) : null;
  }

  async listCustomerOrders(customerIdentifier: string) {
    return this.orders
      .filter((order) => order.customerIdentifier === customerIdentifier)
      .map((order) => this.attachOrder(order));
  }

  async listAdminOrders(storeCode: 'store_1' | 'store_2' | 'store_3', status?: OrderStatus) {
    return this.orders
      .filter((order) => order.storeCode === storeCode && (!status || order.status === status))
      .map((order) => this.attachOrder(order));
  }

  async updateOrderStatus(input: UpdateOrderStatusInput) {
    const order = this.orders.find((entry) => entry.id === input.orderId) ?? null;
    if (!order) {
      return null;
    }

    order.status = input.status;
    order.updatedAt = input.actedAt;
    if (input.status === 'accepted') order.acceptedAt = input.actedAt;
    if (input.status === 'rejected') {
      order.rejectedAt = input.actedAt;
      order.rejectionReason = input.rejectionReason ?? null;
    }
    if (input.status === 'cancelled_by_customer') {
      order.cancelledAt = input.actedAt;
      order.cancellationReason = input.cancellationReason ?? null;
    }
    if (input.status === 'ready_for_pickup') order.readyAt = input.actedAt;
    if (input.status === 'completed') order.completedAt = input.actedAt;
    if (input.status === 'no_show') order.noShowAt = input.actedAt;

    return order;
  }

  async createOrderEvent(input: CreateOrderEventInput) {
    const event: OrderEventRecord = {
      id: `event-${this.eventSeq++}`,
      orderId: input.orderId,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      metadataJson: input.metadataJson ?? null,
      createdAt: input.createdAt,
    };
    this.orderEvents.push(event);
    return event;
  }

  async createOrderNotification(input: CreateOrderNotificationInput) {
    const notification: OrderNotificationRecord = {
      id: `notification-${this.notificationSeq++}`,
      orderId: input.orderId,
      notificationType: input.notificationType,
      channel: input.channel,
      status: input.status,
      recipientCustomerIdentifier: input.recipientCustomerIdentifier ?? null,
      payloadJson: input.payloadJson ?? null,
      failureReason: input.failureReason ?? null,
      createdAt: input.createdAt,
      processedAt: input.processedAt ?? null,
    };
    this.orderNotifications.push(notification);
    return notification;
  }

  async getCustomerOrderFlags(customerIdentifier: string) {
    return this.customerFlags.find((entry) => entry.customerIdentifier === customerIdentifier) ?? null;
  }

  async incrementCustomerNoShowCount(customerIdentifier: string, actedAt: string) {
    const existing = await this.getCustomerOrderFlags(customerIdentifier);
    if (existing) {
      existing.noShowCount += 1;
      existing.updatedAt = actedAt;
      return existing;
    }

    const created = { customerIdentifier, noShowCount: 1, updatedAt: actedAt };
    this.customerFlags.push(created);
    return created;
  }

  async findWalletByCustomerIdentifier(customerIdentifier: string) {
    return this.wallets.find((wallet) => wallet.customerIdentifier === customerIdentifier) ?? null;
  }

  async createWallet(input: CreateWalletInput) {
    const existing = await this.findWalletByCustomerIdentifier(input.customerIdentifier);
    if (existing) return existing;
    const now = this.nextDate();
    const wallet = {
      id: `wallet-${this.walletSeq++}`,
      customerIdentifier: input.customerIdentifier,
      currencyCode: input.currencyCode,
      createdAt: now,
      updatedAt: now,
    };
    this.wallets.push(wallet);
    return wallet;
  }

  async getPostedBalance(walletId: string) {
    return this.ledgerEntries
      .filter((entry) => entry.walletId === walletId && entry.status === 'posted')
      .reduce((sum, entry) => sum + entry.amountSigned, 0);
  }

  async listLedgerEntries(walletId: string) {
    return this.ledgerEntries.filter((entry) => entry.walletId === walletId);
  }

  async listReferenceEntries(walletId: string, referenceType: WalletReferenceType, referenceId: string) {
    return this.ledgerEntries.filter(
      (entry) =>
        entry.walletId === walletId &&
        entry.referenceType === referenceType &&
        entry.referenceId === referenceId,
    );
  }

  async createLedgerEntry(input: CreateLedgerEntryInput) {
    const entry: WalletLedgerEntry = {
      id: `entry-${this.ledgerSeq++}`,
      walletId: input.walletId,
      entryType: input.entryType,
      amountSigned: input.amountSigned,
      currencyCode: input.currencyCode,
      status: input.status,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      externalReference: input.externalReference ?? null,
      note: input.note ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdByRole: input.createdByRole ?? null,
      createdAt: this.nextDate(),
    };
    this.ledgerEntries.push(entry);
    return entry;
  }

  async createTopupRequest(input: CreateTopupRequestInput) {
    const request: WalletTopupRequest = {
      id: `topup-${this.topupRequests.length + 1}`,
      walletId: input.walletId,
      method: input.method,
      requestedAmount: input.requestedAmount,
      status: input.status,
      submittedReference: input.submittedReference ?? null,
      reviewedByUserId: null,
      reviewedAt: null,
      note: input.note ?? null,
      createdAt: this.nextDate(),
      updatedAt: this.nextDate(),
    };
    this.topupRequests.push(request);
    return request;
  }

  async getTopupRequestById(topupRequestId: string) {
    return this.topupRequests.find((item) => item.id === topupRequestId) ?? null;
  }

  async reviewTopupRequest(input: ReviewTopupRequestInput) {
    const request = this.topupRequests.find((item) => item.id === input.topupRequestId) ?? null;
    if (!request) return null;
    request.status = input.status;
    request.reviewedByUserId = input.reviewedByUserId;
    request.reviewedAt = input.reviewedAt;
    request.note = input.note ?? null;
    request.updatedAt = input.reviewedAt;
    return request;
  }

  async runInTransaction<T>(callback: (repository: OrderRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

describe('order service', () => {
  let repository: InMemoryOrderRepository;

  beforeEach(async () => {
    repository = new InMemoryOrderRepository();
    const wallet = await repository.createWallet({
      customerIdentifier: 'demo-wallet-customer',
      currencyCode: 'CLP',
    });
    await repository.createLedgerEntry({
      walletId: wallet.id,
      entryType: 'topup_cashier',
      amountSigned: 10000,
      currencyCode: 'CLP',
      status: 'posted',
      referenceType: 'cashier_topup',
      referenceId: 'seed',
    });
  });

  it('creates an order and posts a wallet debit plus creation event', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 2 }],
    });

    expect(order.status).toBe('pending_acceptance');
    expect(order.totalAmount).toBe(3600);
    expect(repository.ledgerEntries.at(-1)?.entryType).toBe('order_payment');
    expect(repository.ledgerEntries.at(-1)?.amountSigned).toBe(-3600);
    expect(order.events[0]?.eventType).toBe('order_created');
  });

  it('rejects order creation when wallet balance is insufficient', async () => {
    await expect(
      createOrder(repository, {
        customerIdentifier: 'demo-wallet-customer',
        storeCode: 'store_1',
        items: [{ menuItemId: 'menu-2', quantity: 5 }],
      }),
    ).rejects.toBeInstanceOf(OrderInsufficientFundsError);
  });

  it('blocks order creation when order-ahead is disabled', async () => {
    repository.stores[0].isOrderAheadEnabled = false;

    await expect(
      createOrder(repository, {
        customerIdentifier: 'demo-wallet-customer',
        storeCode: 'store_1',
        items: [{ menuItemId: 'menu-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(OrderAheadUnavailableError);
  });

  it('blocks hidden or out-of-stock menu items', async () => {
    repository.storeMenuItems[0].isVisible = false;

    await expect(
      createOrder(repository, {
        customerIdentifier: 'demo-wallet-customer',
        storeCode: 'store_1',
        items: [{ menuItemId: 'menu-1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(MenuItemUnavailableError);
  });

  it('accepting an order creates notification and event records', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    const result = await acceptOrder(repository, {
      orderId: order.id,
      actorUserId: 'staff-1',
      actorRole: 'barista',
    });

    expect(result.transitionApplied).toBe(true);
    expect(result.order.status).toBe('accepted');
    expect(result.event?.eventType).toBe('order_accepted');
    expect(result.notification?.notificationType).toBe('order_accepted');
  });

  it('reject requires a reason and creates reversal plus notification/event', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    await expect(rejectOrder(repository, { orderId: order.id })).rejects.toBeInstanceOf(OrderValidationError);

    const result = await rejectOrder(repository, {
      orderId: order.id,
      reason: 'Sin insumos',
      actorUserId: 'staff-1',
      actorRole: 'owner',
    });

    expect(result.order.status).toBe('rejected');
    expect(repository.ledgerEntries.filter((entry) => entry.referenceId === order.id)).toHaveLength(2);
    expect(repository.ledgerEntries.at(-1)?.entryType).toBe('order_reversal');
    expect(result.event?.eventType).toBe('order_rejected');
    expect(result.notification?.notificationType).toBe('order_rejected');
  });

  it('ready creates notification and event records', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });
    await acceptOrder(repository, { orderId: order.id, actorUserId: 'staff-1', actorRole: 'barista' });

    const result = await markOrderReadyForPickup(repository, {
      orderId: order.id,
      actorUserId: 'staff-1',
      actorRole: 'barista',
    });

    expect(result.order.status).toBe('ready_for_pickup');
    expect(result.event?.eventType).toBe('order_ready');
    expect(result.notification?.notificationType).toBe('order_ready');
  });

  it('complete creates notification and event records', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });
    await acceptOrder(repository, { orderId: order.id, actorUserId: 'staff-1', actorRole: 'barista' });
    await markOrderReadyForPickup(repository, {
      orderId: order.id,
      actorUserId: 'staff-1',
      actorRole: 'barista',
    });

    const result = await completeOrder(repository, {
      orderId: order.id,
      actorUserId: 'staff-2',
      actorRole: 'owner',
    });

    expect(result.order.status).toBe('completed');
    expect(result.event?.eventType).toBe('order_completed');
    expect(result.notification?.notificationType).toBe('order_completed');
  });

  it('no-show requires a reason and increments counter once', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });
    await acceptOrder(repository, { orderId: order.id, actorUserId: 'staff-1', actorRole: 'barista' });

    await expect(markOrderNoShow(repository, { orderId: order.id })).rejects.toBeInstanceOf(OrderValidationError);

    const result = await markOrderNoShow(repository, {
      orderId: order.id,
      reason: 'Cliente no retiró',
      actorUserId: 'staff-1',
      actorRole: 'barista',
    });

    expect(result.order.status).toBe('no_show');
    expect(result.customerFlags.noShowCount).toBe(1);
    expect(result.event?.eventType).toBe('order_no_show');
    expect(result.notification?.notificationType).toBe('order_no_show');

    const duplicate = await markOrderNoShow(repository, {
      orderId: order.id,
      reason: 'Cliente no retiró',
      actorUserId: 'staff-1',
      actorRole: 'barista',
    });

    expect(duplicate.transitionApplied).toBe(false);
    expect(duplicate.customerFlags.noShowCount).toBe(1);
  });

  it('duplicate admin actions do not corrupt state', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    const first = await acceptOrder(repository, { orderId: order.id, actorUserId: 'staff-1', actorRole: 'barista' });
    const second = await acceptOrder(repository, { orderId: order.id, actorUserId: 'staff-1', actorRole: 'barista' });

    expect(first.transitionApplied).toBe(true);
    expect(second.transitionApplied).toBe(false);
    expect(repository.orderEvents.filter((event) => event.orderId === order.id && event.eventType === 'order_accepted')).toHaveLength(1);
  });

  it('invalid transitions are rejected', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    await expect(
      completeOrder(repository, { orderId: order.id, actorUserId: 'staff-2', actorRole: 'owner' }),
    ).rejects.toBeInstanceOf(InvalidOrderStateTransitionError);
  });

  it('customer cancellation creates notification/event and stays reversal-safe', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    vi.advanceTimersByTime(4 * 60 * 1000);

    const result = await cancelOrderByCustomer(repository, { orderId: order.id });
    expect(result.order.status).toBe('cancelled_by_customer');
    expect(result.notification?.notificationType).toBe('order_cancelled');
    expect(result.event?.eventType).toBe('order_cancelled');
    expect(repository.ledgerEntries.filter((entry) => entry.referenceId === order.id)).toHaveLength(2);

    const duplicate = await cancelOrderByCustomer(repository, { orderId: order.id });
    expect(duplicate.transitionApplied).toBe(false);
    expect(repository.ledgerEntries.filter((entry) => entry.referenceId === order.id)).toHaveLength(2);

    vi.useRealTimers();
  });

  it('cancelling after five minutes fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    vi.advanceTimersByTime(6 * 60 * 1000);

    await expect(cancelOrderByCustomer(repository, { orderId: order.id })).rejects.toBeInstanceOf(
      CancellationWindowExpiredError,
    );

    vi.useRealTimers();
  });
});
