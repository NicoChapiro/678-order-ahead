import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCustomerOrders = vi.fn();
const requireAuthenticatedCustomerSession = vi.fn();
class MockCustomerAuthError extends Error {}
class MockOrderValidationError extends Error {}

vi.mock('@/server/modules/orders/repository', () => ({
  orderRepository: {},
}));

vi.mock('@/server/modules/customer-auth/repository', () => ({
  customerAuthRepository: {},
}));

vi.mock('@/server/modules/customer-auth/service', () => ({
  CustomerAuthError: MockCustomerAuthError,
  requireAuthenticatedCustomerSession,
}));

vi.mock('@/server/modules/orders/service', () => ({
  OrderValidationError: MockOrderValidationError,
  listCustomerOrders,
}));

describe('customer orders route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedCustomerSession.mockResolvedValue({
      customer: {
        id: 'customer-11111111-1111-4111-8111-111111111111',
        phoneNumber: '+56912345678',
      },
    });
  });

  it('lists orders from the authenticated me endpoint', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    listCustomerOrders.mockResolvedValue([
      {
        id: 'order-1',
        customerIdentifier: 'customer-11111111-1111-4111-8111-111111111111',
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
      'customer-11111111-1111-4111-8111-111111111111',
    );
    expect(payload.orders).toEqual([
      expect.objectContaining({
        id: 'order-1',
        customerIdentifier: 'customer-11111111-1111-4111-8111-111111111111',
      }),
    ]);
  });

  it('returns 200 with an empty array when the authenticated customer has no orders', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    listCustomerOrders.mockResolvedValue([]);

    const response = await GET(new NextRequest('http://localhost/api/customers/me/orders'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ orders: [] });
  });

  it('keeps order history separated between two different customers', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    requireAuthenticatedCustomerSession
      .mockResolvedValueOnce({
        customer: {
          id: 'customer-11111111-1111-4111-8111-111111111111',
          phoneNumber: '+56911111111',
        },
      })
      .mockResolvedValueOnce({
        customer: {
          id: 'customer-22222222-2222-4222-8222-222222222222',
          phoneNumber: '+56922222222',
        },
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
      'customer-11111111-1111-4111-8111-111111111111',
    );
    expect(listCustomerOrders).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'customer-22222222-2222-4222-8222-222222222222',
    );
  });

  it('does not allow one customer to list another customer identifier directly', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');

    const response = await GET(
      new NextRequest('http://localhost/api/customers/customer-2/orders'),
      {
        params: Promise.resolve({ customerKey: 'customer-2' }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'No encontramos esos pedidos.' });
    expect(listCustomerOrders).not.toHaveBeenCalled();
  });

  it('preserves validation errors as 400 responses', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    listCustomerOrders.mockRejectedValue(new MockOrderValidationError('Customer key inválida.'));

    const response = await GET(new NextRequest('http://localhost/api/customers/me/orders'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'Customer key inválida.' });
  });

  it('returns 401 when there is no authenticated customer session', async () => {
    const { GET } = await import('@/app/api/customers/[customerKey]/orders/route');
    requireAuthenticatedCustomerSession.mockRejectedValue(
      new MockCustomerAuthError('Inicia sesión con tu teléfono para continuar.'),
    );

    const response = await GET(new NextRequest('http://localhost/api/customers/me/orders'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Inicia sesión con tu teléfono para continuar.' });
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
