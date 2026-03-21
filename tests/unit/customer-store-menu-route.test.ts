import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCustomerStoreMenu = vi.fn();

vi.mock('@/server/modules/menu/repository', () => ({
  menuRepository: {},
}));

vi.mock('@/server/modules/menu/service', () => ({
  MenuNotFoundError: class MenuNotFoundError extends Error {},
  getCustomerStoreMenu,
}));

describe('customer store menu route diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs unexpected errors and returns generic 500 error', async () => {
    const { GET } = await import('@/app/api/stores/[storeCode]/menu/route');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    getCustomerStoreMenu.mockRejectedValue(new Error('db is down'));

    const request = new NextRequest('http://localhost/api/stores/store_1/menu');
    const response = await GET(request, { params: Promise.resolve({ storeCode: 'store_1' }) });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Unexpected error.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unexpected error in customer store menu route.',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
