import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWalletSummary = vi.fn();
const listWalletTransactions = vi.fn();
const requireAuthenticatedCustomerSession = vi.fn();
const resolveCustomerIdentifierReference = vi.fn();
class MockCustomerAuthError extends Error {}
class MockCustomerAuthValidationError extends Error {}
class MockWalletValidationError extends Error {}

vi.mock('@/server/modules/customer-auth/repository', () => ({
  customerAuthRepository: {},
}));

vi.mock('@/server/modules/wallet/repository', () => ({
  walletRepository: {},
}));

vi.mock('@/server/modules/customer-auth/service', () => ({
  CustomerAuthError: MockCustomerAuthError,
  CustomerAuthValidationError: MockCustomerAuthValidationError,
  requireAuthenticatedCustomerSession,
  resolveCustomerIdentifierReference,
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
    resolveCustomerIdentifierReference.mockResolvedValue('customer-lookup');
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

  it('resolves phone-based admin wallet lookups without exposing customer keys in the UI', async () => {
    const summaryRoute = await import('@/app/api/wallet/[customerKey]/route');
    getWalletSummary.mockResolvedValue({ currentBalance: 9500, wallet: { customerIdentifier: 'customer-lookup' } });

    const response = await summaryRoute.GET(
      new NextRequest('http://localhost/api/wallet/%2B56912345678'),
      { params: Promise.resolve({ customerKey: '+56912345678' }) },
    );

    expect(response.status).toBe(200);
    expect(resolveCustomerIdentifierReference).toHaveBeenCalledWith(
      expect.anything(),
      '+56912345678',
    );
    expect(getWalletSummary).toHaveBeenCalledWith(expect.anything(), 'customer-lookup');
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
