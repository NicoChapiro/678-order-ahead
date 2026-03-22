import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientHomePage from '@/app/(client)/client/page';

describe('client page order tracking empty state', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/stores/store_1/order-ahead')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            availability: {
              storeCode: 'store_1',
              storeName: 'Store 1',
              isOrderAheadEnabled: true,
              disabledReasonCode: null,
              disabledComment: null,
              updatedAt: '2026-03-22T07:00:00.000Z',
            },
          }),
        });
      }

      if (url.includes('/api/stores/store_1/menu')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            menu: {
              storeCode: 'store_1',
              storeName: 'Store 1',
              items: [],
            },
          }),
        });
      }

      if (url.includes('/api/customers/demo-wallet-customer/orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ orders: [] }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders a calm no-order state without showing a hard error', async () => {
    render(<ClientHomePage />);

    expect(await screen.findByText('Sin pedido activo')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText('No pudimos revisar el estado de tu pedido.'),
      ).not.toBeInTheDocument();
    });
  });
});
