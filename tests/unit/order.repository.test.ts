import { describe, expect, it } from 'vitest';
import { orderEvents, orderItems, orderNotifications, orders } from '@/server/db/schema';
import { makeOrderRepository } from '@/server/modules/orders/repository';

class SerialOnlyDb {
  activeQueries = 0;

  select(selection?: unknown) {
    const root = this;

    return {
      from(table: unknown) {
        return new SerialQuery(root, table, selection);
      },
    };
  }
}

class SerialQuery {
  constructor(
    private readonly db: SerialOnlyDb,
    private readonly table: unknown,
    private readonly selection?: unknown,
  ) {}

  innerJoin() {
    return this;
  }

  leftJoin() {
    return this;
  }

  where() {
    return this;
  }

  limit() {
    return this;
  }

  async orderBy() {
    // Simulate a transaction/connection that rejects parallel queries.
    // The repository regression fix is that related order loads now run serially.
    if (this.db.activeQueries > 0) {
      throw new Error('Concurrent query detected in transaction');
    }

    this.db.activeQueries += 1;
    await Promise.resolve();
    this.db.activeQueries -= 1;

    if (this.selection && this.table === orders) {
      return [
        {
          id: 'order-1',
          customerIdentifier: 'customer_11111111-1111-4111-8111-111111111111',
          storeId: 'store-id-1',
          storeCode: 'store_1',
          storeName: 'Store 1',
          status: 'pending_acceptance',
          currencyCode: 'CLP',
          totalAmount: 3600,
          placedAt: new Date('2026-03-22T10:00:00.000Z'),
          acceptedAt: null,
          rejectedAt: null,
          cancelledAt: null,
          readyAt: null,
          completedAt: null,
          noShowAt: null,
          rejectionReason: null,
          cancellationReason: null,
          createdAt: new Date('2026-03-22T10:00:00.000Z'),
          updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        },
      ];
    }

    if (this.table === orderItems) {
      return [
        {
          id: 'item-1',
          orderId: 'order-1',
          menuItemId: '11111111-1111-1111-1111-111111111111',
          storeMenuItemId: '22222222-2222-2222-2222-222222222222',
          itemNameSnapshot: 'Latte',
          unitPriceAmount: 1800,
          quantity: 2,
          lineTotalAmount: 3600,
          createdAt: new Date('2026-03-22T10:00:00.000Z'),
        },
      ];
    }

    if (this.table === orderEvents) {
      return [];
    }

    if (this.table === orderNotifications) {
      return [];
    }

    return [];
  }
}

describe('order repository detail loading', () => {
  it('loads related order data without issuing parallel queries on a serial transaction connection', async () => {
    const repository = makeOrderRepository(new SerialOnlyDb() as never);

    await expect(repository.getOrderById('order-1')).resolves.toMatchObject({
      id: 'order-1',
      items: [
        expect.objectContaining({
          id: 'item-1',
          itemNameSnapshot: 'Latte',
          quantity: 2,
        }),
      ],
      notifications: [],
      events: [],
    });
  });
});
