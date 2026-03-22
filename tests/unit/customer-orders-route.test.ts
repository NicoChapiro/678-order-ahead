import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCustomerOrders = vi.fn();
class MockOrderValidationError extends Error {}

vi.mock('@/server/modules/orders/repository', () => ({
  orderRepository: {},
}));

vi.mock('@/server/modules/orders/service', () => ({
  OrderValidationError: MockOrderValidationError,
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

  it('returns 200 with an empty array when the customer has no orders', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    listCustomerOrders.mockResolvedValue([]);

    const response = await GET(
      new NextRequest('http://localhost/api/customers/demo-wallet-customer/orders'),
      { params: Promise.resolve({ customerKey: 'demo-wallet-customer' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ orders: [] });
  });

  it('preserves validation errors as 400 responses', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    listCustomerOrders.mockRejectedValue(new MockOrderValidationError('Customer key inválida.'));

    const response = await GET(new NextRequest('http://localhost/api/customers/%20/orders'), {
      params: Promise.resolve({ customerKey: ' ' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'Customer key inválida.' });
  });

  it('returns a calm 500 message for unexpected failures', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    listCustomerOrders.mockRejectedValue(new Error('db offline'));

    const response = await GET(
      new NextRequest('http://localhost/api/customers/demo-wallet-customer/orders'),
      { params: Promise.resolve({ customerKey: 'demo-wallet-customer' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: 'No pudimos revisar el estado de tu pedido.' });
    expect(consoleError).toHaveBeenCalledWith(
      'Unexpected error in customer orders route.',
      expect.any(Error),
    );

    consoleError.mockRestore();
  });
});
