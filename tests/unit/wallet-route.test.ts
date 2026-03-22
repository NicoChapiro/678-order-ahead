import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWalletSummary = vi.fn();
const listWalletTransactions = vi.fn();
const requireAuthenticatedCustomerSession = vi.fn();
class MockCustomerAuthError extends Error {}
class MockWalletValidationError extends Error {}

vi.mock('@/server/modules/customer-auth/repository', () => ({
  customerAuthRepository: {},
}));

vi.mock('@/server/modules/wallet/repository', () => ({
  walletRepository: {},
}));

vi.mock('@/server/modules/customer-auth/service', () => ({
  CustomerAuthError: MockCustomerAuthError,
  requireAuthenticatedCustomerSession,
}));

vi.mock('@/server/modules/wallet/service', () => ({
  getWalletSummary,
  listWalletTransactions,
  WalletValidationError: MockWalletValidationError,
}));

describe('wallet routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedCustomerSession.mockResolvedValue({
      customer: { id: 'customer-1', phoneNumber: '+56912345678' },
    });
  });

  it('loads the authenticated customer wallet summary from the me endpoint', async () => {
    const { GET } = await import('@/app/api/wallet/[customerKey]/route');
    getWalletSummary.mockResolvedValue({ currentBalance: 7000, wallet: { customerIdentifier: 'customer-1' } });

    const response = await GET(new NextRequest('http://localhost/api/wallet/me'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(requireAuthenticatedCustomerSession).toHaveBeenCalled();
    expect(getWalletSummary).toHaveBeenCalledWith(expect.anything(), 'customer-1');
    expect(payload.currentBalance).toBe(7000);
  });

  it('rejects explicit customer identifiers from the customer-facing wallet summary route', async () => {
    const { GET } = await import('@/app/api/wallet/[customerKey]/route');

    const response = await GET(
      new NextRequest('http://localhost/api/wallet/%2B56912345678'),
      { params: Promise.resolve({ customerKey: '+56912345678' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'No encontramos esa wallet.' });
    expect(requireAuthenticatedCustomerSession).not.toHaveBeenCalled();
    expect(getWalletSummary).not.toHaveBeenCalled();
  });

  it('loads wallet transactions for the authenticated customer', async () => {
    const { GET } = await import('@/app/api/wallet/[customerKey]/transactions/route');
    listWalletTransactions.mockResolvedValue({ transactions: [{ id: 'entry-1' }] });

    const response = await GET(new NextRequest('http://localhost/api/wallet/me/transactions'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listWalletTransactions).toHaveBeenCalledWith(expect.anything(), 'customer-1');
    expect(payload.transactions).toEqual([{ id: 'entry-1' }]);
  });

  it('rejects explicit customer identifiers from the customer-facing wallet transactions route', async () => {
    const { GET } = await import('@/app/api/wallet/[customerKey]/transactions/route');

    const response = await GET(
      new NextRequest('http://localhost/api/wallet/customer-2/transactions'),
      { params: Promise.resolve({ customerKey: 'customer-2' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'No encontramos esa wallet.' });
    expect(requireAuthenticatedCustomerSession).not.toHaveBeenCalled();
    expect(listWalletTransactions).not.toHaveBeenCalled();
  });

  it('returns 401 when a me wallet lookup has no authenticated customer session', async () => {
    const { GET } = await import('@/app/api/wallet/[customerKey]/route');
    requireAuthenticatedCustomerSession.mockRejectedValue(
      new MockCustomerAuthError('Inicia sesión con tu teléfono para continuar.'),
    );

    const response = await GET(new NextRequest('http://localhost/api/wallet/me'), {
      params: Promise.resolve({ customerKey: 'me' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Inicia sesión con tu teléfono para continuar.' });
  });
});
