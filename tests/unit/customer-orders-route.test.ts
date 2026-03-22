import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCustomerOrders = vi.fn();
const resolveCustomerIdentifier = vi.fn();
const setCustomerIdentifierCookie = vi.fn();
class MockOrderValidationError extends Error {}

vi.mock('@/server/modules/orders/repository', () => ({
  orderRepository: {},
}));

vi.mock('@/server/modules/customer-identity/session', () => ({
  resolveCustomerIdentifier,
  setCustomerIdentifierCookie,
}));

vi.mock('@/server/modules/orders/service', () => ({
  OrderValidationError: MockOrderValidationError,
  listCustomerOrders,
}));

describe('customer orders route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCustomerIdentifier.mockReturnValue({
      customerIdentifier: 'customer_11111111-1111-4111-8111-111111111111',
      isNew: true,
    });
  });

  it('lists customer orders from the session-scoped me endpoint', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    listCustomerOrders.mockResolvedValue([
      {
        id: 'order-1',
        customerIdentifier: 'customer_11111111-1111-4111-8111-111111111111',
        status: 'pending',
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/customers/me/orders'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listCustomerOrders).toHaveBeenCalledWith(
      expect.anything(),
      'customer_11111111-1111-4111-8111-111111111111',
    );
    expect(setCustomerIdentifierCookie).toHaveBeenCalled();
    expect(payload.orders).toEqual([
      expect.objectContaining({
        id: 'order-1',
        customerIdentifier: 'customer_11111111-1111-4111-8111-111111111111',
      }),
    ]);
  });

  it('returns 200 with an empty array when the session customer has no orders', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    listCustomerOrders.mockResolvedValue([]);

    const response = await GET(new NextRequest('http://localhost/api/customers/me/orders'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ orders: [] });
  });

  it('separates order history across two different customer sessions', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    resolveCustomerIdentifier
      .mockReturnValueOnce({
        customerIdentifier: 'customer_11111111-1111-4111-8111-111111111111',
        isNew: false,
      })
      .mockReturnValueOnce({
        customerIdentifier: 'customer_22222222-2222-4222-8222-222222222222',
        isNew: false,
      });
    listCustomerOrders
      .mockResolvedValueOnce([{ id: 'order-a' }])
      .mockResolvedValueOnce([{ id: 'order-b' }]);

    await GET(new NextRequest('http://localhost/api/customers/me/orders'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
    await GET(new NextRequest('http://localhost/api/customers/me/orders'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });

    expect(listCustomerOrders).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'customer_11111111-1111-4111-8111-111111111111',
    );
    expect(listCustomerOrders).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'customer_22222222-2222-4222-8222-222222222222',
    );
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

    const response = await GET(new NextRequest('http://localhost/api/customers/me/orders'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
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
