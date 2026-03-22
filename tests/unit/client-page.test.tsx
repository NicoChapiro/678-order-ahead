import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientHomePage from '@/app/(client)/client/page';

describe('client page order actions', () => {
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
              items: [
                {
                  storeMenuItemId: 'store-menu-item-1',
                  menuItemId: '11111111-1111-1111-1111-111111111111',
                  code: 'latte',
                  name: 'Latte',
                  description: 'Café con leche',
                  priceAmount: 3500,
                  currencyCode: 'CLP',
                  isVisible: true,
                  isInStock: true,
                  sortOrder: 1,
                  baseIsActive: true,
                  createdAt: '2026-03-22T07:00:00.000Z',
                  updatedAt: '2026-03-22T07:00:00.000Z',
                },
              ],
            },
          }),
        });
      }

      if (url.includes('/api/customers/me/orders')) {
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

  it('resets the submit state and shows a calm message when placing an order fails by network', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/orders')) {
        return Promise.reject(new Error('Failed to fetch'));
      }

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
              items: [
                {
                  storeMenuItemId: 'store-menu-item-1',
                  menuItemId: '11111111-1111-1111-1111-111111111111',
                  code: 'latte',
                  name: 'Latte',
                  description: 'Café con leche',
                  priceAmount: 3500,
                  currencyCode: 'CLP',
                  isVisible: true,
                  isInStock: true,
                  sortOrder: 1,
                  baseIsActive: true,
                  createdAt: '2026-03-22T07:00:00.000Z',
                  updatedAt: '2026-03-22T07:00:00.000Z',
                },
              ],
            },
          }),
        });
      }

      if (url.includes('/api/customers/me/orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ orders: [] }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<ClientHomePage />);

    const addButton = await screen.findByRole('button', { name: '+' });
    fireEvent.click(addButton);

    const submitButton = screen.getByRole('button', { name: 'Pedir ahora' });
    fireEvent.click(submitButton);

    expect(
      await screen.findByText('No pudimos confirmar tu pedido. Intenta de nuevo.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pedir ahora' })).toBeEnabled();
    });
  });

  it('recovers the cancel action when the request fails', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/orders/order-1/cancel')) {
        return Promise.reject(new Error('Failed to fetch'));
      }

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
              items: [
                {
                  storeMenuItemId: 'store-menu-item-1',
                  menuItemId: '11111111-1111-1111-1111-111111111111',
                  code: 'latte',
                  name: 'Latte',
                  description: 'Café con leche',
                  priceAmount: 3500,
                  currencyCode: 'CLP',
                  isVisible: true,
                  isInStock: true,
                  sortOrder: 1,
                  baseIsActive: true,
                  createdAt: '2026-03-22T07:00:00.000Z',
                  updatedAt: '2026-03-22T07:00:00.000Z',
                },
              ],
            },
          }),
        });
      }

      if (url.includes('/api/customers/me/orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            orders: [
              {
                id: 'order-1',
                customerIdentifier: 'customer_11111111-1111-4111-8111-111111111111',
                storeCode: 'store_1',
                storeName: 'Store 1',
                status: 'pending_acceptance',
                totalAmount: 3500,
                placedAt: '2026-03-22T07:10:00.000Z',
                acceptedAt: null,
                rejectedAt: null,
                cancelledAt: null,
                readyAt: null,
                completedAt: null,
                noShowAt: null,
                rejectionReason: null,
                cancellationReason: null,
                lastEvent: null,
                items: [
                  {
                    id: 'item-1',
                    itemNameSnapshot: 'Latte',
                    quantity: 1,
                    unitPriceAmount: 3500,
                    lineTotalAmount: 3500,
                  },
                ],
              },
            ],
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<ClientHomePage />);

    const cancelButton = await screen.findByRole('button', { name: 'Cancelar pedido' });
    fireEvent.click(cancelButton);

    expect(
      await screen.findByText('No pudimos cancelar tu pedido. Intenta de nuevo.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancelar pedido' })).toBeEnabled();
    });
  });

  it('resets quantities and shows confirmation after a successful order', async () => {
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
              items: [
                {
                  storeMenuItemId: 'store-menu-item-1',
                  menuItemId: '11111111-1111-1111-1111-111111111111',
                  code: 'latte',
                  name: 'Latte',
                  description: 'Café con leche',
                  priceAmount: 3500,
                  currencyCode: 'CLP',
                  isVisible: true,
                  isInStock: true,
                  sortOrder: 1,
                  baseIsActive: true,
                  createdAt: '2026-03-22T07:00:00.000Z',
                  updatedAt: '2026-03-22T07:00:00.000Z',
                },
              ],
            },
          }),
        });
      }

      if (url.includes('/api/orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            order: { id: 'order-1' },
          }),
        });
      }

      if (url.includes('/api/customers/me/orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            orders: [
              {
                id: 'order-1',
                customerIdentifier: 'customer_11111111-1111-4111-8111-111111111111',
                storeCode: 'store_1',
                storeName: 'Store 1',
                status: 'pending_acceptance',
                totalAmount: 3500,
                placedAt: '2026-03-22T07:10:00.000Z',
                acceptedAt: null,
                rejectedAt: null,
                cancelledAt: null,
                readyAt: null,
                completedAt: null,
                noShowAt: null,
                rejectionReason: null,
                cancellationReason: null,
                lastEvent: null,
                items: [
                  {
                    id: 'item-1',
                    itemNameSnapshot: 'Latte',
                    quantity: 1,
                    unitPriceAmount: 3500,
                    lineTotalAmount: 3500,
                  },
                ],
              },
            ],
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<ClientHomePage />);

    const addButton = await screen.findByRole('button', { name: '+' });
    fireEvent.click(addButton);

    fireEvent.click(screen.getByRole('button', { name: 'Pedir ahora' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/orders',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            storeCode: 'store_1',
            items: [{ menuItemId: '11111111-1111-1111-1111-111111111111', quantity: 1 }],
          }),
        }),
      );
    });

    expect(
      await screen.findByText('Pedido enviado. Aquí mismo verás cuándo esté listo para retiro.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Tu pedido ya entró a la tienda.')).toBeInTheDocument();
      expect(screen.getByText('$0')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pedir ahora' })).toBeDisabled();
    });
  });
});
