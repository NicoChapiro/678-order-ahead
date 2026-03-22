import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createOrder = vi.fn();
class MockMenuItemUnavailableError extends Error {}
class MockOrderAheadUnavailableError extends Error {}
class MockOrderInsufficientFundsError extends Error {}
class MockOrderNotFoundError extends Error {}
class MockOrderValidationError extends Error {}

vi.mock('@/server/modules/orders/repository', () => ({
  orderRepository: {},
}));

vi.mock('@/server/modules/orders/service', () => ({
  createOrder,
  MenuItemUnavailableError: MockMenuItemUnavailableError,
  OrderAheadUnavailableError: MockOrderAheadUnavailableError,
  OrderInsufficientFundsError: MockOrderInsufficientFundsError,
  OrderNotFoundError: MockOrderNotFoundError,
  OrderValidationError: MockOrderValidationError,
}));

describe('orders route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an order successfully', async () => {
    const { POST } = await import('@/app/api/orders/route');
    createOrder.mockResolvedValue({ id: 'order-1' });

    const response = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerIdentifier: 'demo-wallet-customer',
          storeCode: 'store_1',
          items: [{ menuItemId: '11111111-1111-1111-1111-111111111111', quantity: 1 }],
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({ order: { id: 'order-1' } });
  });

  it('preserves known business error statuses', async () => {
    const { POST } = await import('@/app/api/orders/route');

    const request = () =>
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerIdentifier: 'demo-wallet-customer',
          storeCode: 'store_1',
          items: [{ menuItemId: '11111111-1111-1111-1111-111111111111', quantity: 1 }],
        }),
      });

    createOrder.mockRejectedValueOnce(
      new MockOrderValidationError('Orders must include at least one item.'),
    );
    let response = await POST(request());
    expect(response.status).toBe(400);

    createOrder.mockRejectedValueOnce(
      new MockOrderAheadUnavailableError('Order-ahead is currently unavailable for this store.'),
    );
    response = await POST(request());
    expect(response.status).toBe(409);

    createOrder.mockRejectedValueOnce(
      new MockMenuItemUnavailableError("Menu item 'Latte' is unavailable."),
    );
    response = await POST(request());
    expect(response.status).toBe(409);

    createOrder.mockRejectedValueOnce(new MockOrderInsufficientFundsError('Insufficient funds.'));
    response = await POST(request());
    expect(response.status).toBe(402);

    createOrder.mockRejectedValueOnce(new MockOrderNotFoundError("Store 'store_1' was not found."));
    response = await POST(request());
    expect(response.status).toBe(404);
  });

  it('returns a calm 500 message for unexpected failures and logs them', async () => {
    const { POST } = await import('@/app/api/orders/route');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createOrder.mockRejectedValue(new Error('db offline'));

    const response = await POST(
      new NextRequest('http://localhost/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerIdentifier: 'demo-wallet-customer',
          storeCode: 'store_1',
          items: [{ menuItemId: '11111111-1111-1111-1111-111111111111', quantity: 1 }],
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: 'No pudimos confirmar tu pedido. Intenta de nuevo.' });
    expect(consoleError).toHaveBeenCalledWith(
      'Unexpected error in create order route.',
      expect.any(Error),
    );

    consoleError.mockRestore();
  });
});
