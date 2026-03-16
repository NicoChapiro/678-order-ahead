import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCustomerOrderAheadAvailability = vi.fn();

vi.mock('@/server/modules/stores/repository', () => ({
  storeAvailabilityRepository: {},
}));

vi.mock('@/server/modules/stores/service', () => ({
  StoreNotFoundError: class StoreNotFoundError extends Error {},
  getCustomerOrderAheadAvailability,
}));

describe('customer order-ahead route diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs unexpected errors and returns generic 500 error', async () => {
    const { GET } = await import('@/app/api/stores/[storeCode]/order-ahead/route');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    getCustomerOrderAheadAvailability.mockRejectedValue(new Error('db is down'));

    const request = new NextRequest('http://localhost/api/stores/store_1/order-ahead');
    const response = await GET(request, { params: Promise.resolve({ storeCode: 'store_1' }) });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Unexpected error.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unexpected error in customer order-ahead availability route.',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
