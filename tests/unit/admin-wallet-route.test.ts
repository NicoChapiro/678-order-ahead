import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRequiredStaffSession = vi.fn();
const getWalletSummary = vi.fn();
const listWalletTransactions = vi.fn();
const resolveCustomerIdentifierReference = vi.fn();
class MockStaffAuthError extends Error {}
class MockCustomerAuthValidationError extends Error {}
class MockWalletValidationError extends Error {}

vi.mock('@/server/modules/customer-auth/repository', () => ({
  customerAuthRepository: {},
}));

vi.mock('@/server/modules/wallet/repository', () => ({
  walletRepository: {},
}));

vi.mock('@/server/modules/staff-auth/service', () => ({
  StaffAuthError: MockStaffAuthError,
  getRequiredStaffSession,
}));

vi.mock('@/server/modules/customer-auth/service', () => ({
  CustomerAuthValidationError: MockCustomerAuthValidationError,
  resolveCustomerIdentifierReference,
}));

vi.mock('@/server/modules/wallet/service', () => ({
  getWalletSummary,
  listWalletTransactions,
  WalletValidationError: MockWalletValidationError,
}));

describe('admin wallet lookup routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequiredStaffSession.mockResolvedValue({ staffUserId: 'staff-1', role: 'owner' });
    resolveCustomerIdentifierReference.mockResolvedValue('customer-lookup');
  });

  it('lets authenticated staff load wallet summary by phone or customer id', async () => {
    const { GET } = await import('@/app/api/admin/wallets/[customerKey]/route');
    getWalletSummary.mockResolvedValue({ currentBalance: 9500, wallet: { customerIdentifier: 'customer-lookup' } });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/wallets/%2B56912345678'),
      { params: Promise.resolve({ customerKey: '+56912345678' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getRequiredStaffSession).toHaveBeenCalled();
    expect(resolveCustomerIdentifierReference).toHaveBeenCalledWith(
      expect.anything(),
      '+56912345678',
    );
    expect(getWalletSummary).toHaveBeenCalledWith(expect.anything(), 'customer-lookup');
    expect(payload.currentBalance).toBe(9500);
  });

  it('lets authenticated staff load wallet transactions by phone or customer id', async () => {
    const { GET } = await import('@/app/api/admin/wallets/[customerKey]/transactions/route');
    listWalletTransactions.mockResolvedValue({ transactions: [{ id: 'entry-1' }] });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/wallets/customer-1/transactions'),
      { params: Promise.resolve({ customerKey: 'customer-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listWalletTransactions).toHaveBeenCalledWith(expect.anything(), 'customer-lookup');
    expect(payload.transactions).toEqual([{ id: 'entry-1' }]);
  });

  it('rejects unauthenticated staff access', async () => {
    const { GET } = await import('@/app/api/admin/wallets/[customerKey]/route');
    getRequiredStaffSession.mockRejectedValue(new MockStaffAuthError('Staff session is required.'));

    const response = await GET(
      new NextRequest('http://localhost/api/admin/wallets/customer-1'),
      { params: Promise.resolve({ customerKey: 'customer-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Staff session is required.' });
  });
});
