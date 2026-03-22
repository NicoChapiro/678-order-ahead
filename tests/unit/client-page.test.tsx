import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientHomePage from '@/app/(client)/client/page';

function buildAuthenticatedSession(balance = 12000) {
  return {
    authenticated: true,
    customer: { id: 'customer-1', phoneNumber: '+56912345678' },
    walletSummary: {
      wallet: {
        id: 'wallet-1',
        customerIdentifier: 'customer-1',
        currencyCode: 'CLP',
        createdAt: '2026-03-22T07:00:00.000Z',
        updatedAt: '2026-03-22T07:00:00.000Z',
      },
      currentBalance: balance,
    },
  };
}

describe('client page order actions', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/customer-auth/session')) {
        return Promise.resolve({
          ok: true,
          json: async () => buildAuthenticatedSession(),
        });
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows the minimal auth step before ordering when there is no customer session', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/customer-auth/session')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ authenticated: false, customer: null, walletSummary: null }),
        });
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
              items: [],
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<ClientHomePage />);

    expect(await screen.findByText('Primero ingresa con tu teléfono')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pedir ahora' })).not.toBeInTheDocument();
  });

  it('requests an OTP and advances to the code verification step', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/customer-auth/request-otp')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            phoneNumber: '+56912345678',
            expiresAt: '2026-03-22T07:10:00.000Z',
            message: 'Te enviamos un código por SMS.',
          }),
        });
      }

      if (url.includes('/api/customer-auth/session')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ authenticated: false, customer: null, walletSummary: null }),
        });
      }

      if (url.includes('/api/stores/store_1/order-ahead')) {
        return Promise.resolve({ ok: true, json: async () => ({ availability: { storeCode: 'store_1', storeName: 'Store 1', isOrderAheadEnabled: true, disabledReasonCode: null, disabledComment: null, updatedAt: '2026-03-22T07:00:00.000Z' } }) });
      }

      if (url.includes('/api/stores/store_1/menu')) {
        return Promise.resolve({ ok: true, json: async () => ({ menu: { storeCode: 'store_1', storeName: 'Store 1', items: [] } }) });
      }

      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<ClientHomePage />);

    fireEvent.change(await screen.findByLabelText('Teléfono'), {
      target: { value: '+56912345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));

    expect(await screen.findByText('Te enviamos un código por SMS.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar código' })).toBeInTheDocument();
  });

  it('resets quantities, refreshes balance, and shows confirmation after a successful order', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/customer-auth/session')) {
        return Promise.resolve({
          ok: true,
          json: async () => buildAuthenticatedSession(url.includes('refresh') ? 8500 : 12000),
        });
      }

      if (url.includes('/api/orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ order: { id: 'order-1' } }),
        });
      }

      if (url.includes('/api/customers/me/orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            orders: [
              {
                id: 'order-1',
                customerIdentifier: 'customer-1',
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

      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<ClientHomePage />);

    const addButton = await screen.findByRole('button', { name: '+' });
    fireEvent.click(addButton);
    fireEvent.click(screen.getByRole('button', { name: 'Pedir ahora' }));

    expect(
      await screen.findByText('Pedido enviado. Aquí mismo verás cuándo esté listo para retiro.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Tu pedido ya entró a la tienda.')).toBeInTheDocument();
      expect(screen.getByText('Tu saldo disponible es $12.000.')).toBeInTheDocument();
    });
  });

  it('maps the wallet balance backend error to calm Spanish copy', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/orders')) {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            error: 'Insufficient wallet balance for this debit.',
          }),
        });
      }

      if (url.includes('/api/customer-auth/session')) {
        return Promise.resolve({
          ok: true,
          json: async () => buildAuthenticatedSession(3500),
        });
      }

      if (url.includes('/api/stores/store_1/order-ahead')) {
        return Promise.resolve({ ok: true, json: async () => ({ availability: { storeCode: 'store_1', storeName: 'Store 1', isOrderAheadEnabled: true, disabledReasonCode: null, disabledComment: null, updatedAt: '2026-03-22T07:00:00.000Z' } }) });
      }

      if (url.includes('/api/stores/store_1/menu')) {
        return Promise.resolve({ ok: true, json: async () => ({ menu: { storeCode: 'store_1', storeName: 'Store 1', items: [ { storeMenuItemId: 'store-menu-item-1', menuItemId: '11111111-1111-1111-1111-111111111111', code: 'latte', name: 'Latte', description: 'Café con leche', priceAmount: 3500, currencyCode: 'CLP', isVisible: true, isInStock: true, sortOrder: 1, baseIsActive: true, createdAt: '2026-03-22T07:00:00.000Z', updatedAt: '2026-03-22T07:00:00.000Z' } ] } }) });
      }

      if (url.includes('/api/customers/me/orders')) {
        return Promise.resolve({ ok: true, json: async () => ({ orders: [] }) });
      }

      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    render(<ClientHomePage />);

    const addButton = await screen.findByRole('button', { name: '+' });
    fireEvent.click(addButton);

    const submitButton = screen.getByRole('button', { name: 'Pedir ahora' });
    fireEvent.click(submitButton);

    expect(
      await screen.findByText(
        'No pudimos confirmar el pago de tu pedido. Revisa tu saldo e intenta de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Insufficient wallet balance for this debit.'),
    ).not.toBeInTheDocument();
  });
});
