import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptOrder,
  cancelOrderByCustomer,
  CancellationWindowExpiredError,
  createOrder,
  InvalidOrderStateTransitionError,
  markOrderNoShow,
  MenuItemUnavailableError,
  OrderAheadUnavailableError,
  OrderInsufficientFundsError,
  rejectOrder,
} from '@/server/modules/orders/service';
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
  WalletLedgerEntry,
  WalletReferenceType,
  WalletTopupRequest,
} from '@/server/modules/wallet/types';

class InMemoryOrderRepository implements OrderRepository {
  walletSeq = 1;
  orderSeq = 1;
  orderItemSeq = 1;
  ledgerSeq = 1;
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
  customerFlags: CustomerOrderFlags[] = [];
  topupRequests: WalletTopupRequest[] = [];

  private nextDate() {
    this.tick += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, this.tick)).toISOString();
  }

  private attachItems(order: OrderRecord): OrderDetail {
    return {
      ...order,
      items: this.orderItems.filter((item) => item.orderId === order.id),
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
    return order ? this.attachItems(order) : null;
  }

  async listCustomerOrders(customerIdentifier: string) {
    return this.orders
      .filter((order) => order.customerIdentifier === customerIdentifier)
      .map((order) => this.attachItems(order));
  }

  async listAdminOrders(storeCode: 'store_1' | 'store_2' | 'store_3') {
    return this.orders.filter((order) => order.storeCode === storeCode).map((order) => this.attachItems(order));
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

  it('creates an order and posts a wallet debit', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 2 }],
    });

    expect(order.status).toBe('pending_acceptance');
    expect(order.totalAmount).toBe(3600);
    expect(repository.ledgerEntries.at(-1)?.entryType).toBe('order_payment');
    expect(repository.ledgerEntries.at(-1)?.amountSigned).toBe(-3600);
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

  it('rejecting a pending order creates a reversal', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    const updated = await rejectOrder(repository, { orderId: order.id, reason: 'Sin insumos' });

    expect(updated.status).toBe('rejected');
    expect(repository.ledgerEntries.filter((entry) => entry.referenceId === order.id)).toHaveLength(2);
    expect(repository.ledgerEntries.at(-1)?.entryType).toBe('order_reversal');
  });

  it('cancelling within five minutes creates a reversal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    vi.advanceTimersByTime(4 * 60 * 1000);

    const updated = await cancelOrderByCustomer(repository, { orderId: order.id });
    expect(updated.status).toBe('cancelled_by_customer');
    expect(repository.ledgerEntries.at(-1)?.entryType).toBe('order_reversal');

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

  it('prevents invalid state transitions', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    await expect(acceptOrder(repository, { orderId: order.id })).resolves.toBeTruthy();
    await expect(rejectOrder(repository, { orderId: order.id, reason: 'late reject' })).rejects.toBeInstanceOf(
      InvalidOrderStateTransitionError,
    );
  });

  it('marking no-show increments customer counter', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });
    await acceptOrder(repository, { orderId: order.id });

    const result = await markOrderNoShow(repository, { orderId: order.id });
    expect(result.order.status).toBe('no_show');
    expect(result.customerFlags.noShowCount).toBe(1);
  });

  it('prevents duplicate reversals', async () => {
    const order = await createOrder(repository, {
      customerIdentifier: 'demo-wallet-customer',
      storeCode: 'store_1',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    });

    await rejectOrder(repository, { orderId: order.id, reason: 'Sin stock' });

    await expect(rejectOrder(repository, { orderId: order.id, reason: 'Duplicado' })).rejects.toBeInstanceOf(
      InvalidOrderStateTransitionError,
    );
  });
});
