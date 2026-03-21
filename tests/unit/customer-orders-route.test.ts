import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCustomerOrders = vi.fn();

vi.mock('@/server/modules/orders/repository', () => ({
  orderRepository: {},
}));

vi.mock('@/server/modules/orders/service', () => ({
  OrderValidationError: class OrderValidationError extends Error {},
  listCustomerOrders,
}));

describe('customer orders route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists customer orders from the customer-scoped endpoint', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    listCustomerOrders.mockResolvedValue([
      { id: 'order-1', customerIdentifier: 'demo-wallet-customer', status: 'pending' },
    ]);

    const response = await GET(
      new NextRequest('http://localhost/api/customers/demo-wallet-customer/orders'),
      { params: Promise.resolve({ customerKey: 'demo-wallet-customer' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listCustomerOrders).toHaveBeenCalledWith(expect.anything(), 'demo-wallet-customer');
    expect(payload.orders).toEqual([
      expect.objectContaining({ id: 'order-1', customerIdentifier: 'demo-wallet-customer' }),
    ]);
  });
});
