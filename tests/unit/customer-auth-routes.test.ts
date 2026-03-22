import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestCustomerOtp = vi.fn();
const verifyCustomerOtp = vi.fn();
const getAuthenticatedCustomerSession = vi.fn();
const signOutCustomerSession = vi.fn();
const setCustomerSessionCookie = vi.fn();
const clearCustomerSessionCookie = vi.fn();
const getWalletSummary = vi.fn();
const getSmsProvider = vi.fn();

class MockCustomerAuthError extends Error {}
class MockCustomerAuthValidationError extends Error {}
class MockCustomerAuthInvalidOtpError extends Error {}
class MockCustomerAuthExpiredOtpError extends Error {}

vi.mock('@/server/modules/customer-auth/repository', () => ({
  customerAuthRepository: {},
}));

vi.mock('@/server/modules/wallet/repository', () => ({
  walletRepository: {},
}));

vi.mock('@/server/modules/customer-auth/sms', () => ({
  getSmsProvider,
}));

vi.mock('@/server/modules/customer-auth/session', () => ({
  setCustomerSessionCookie,
  clearCustomerSessionCookie,
}));

vi.mock('@/server/modules/wallet/service', () => ({
  getWalletSummary,
}));

vi.mock('@/server/modules/customer-auth/service', () => ({
  CustomerAuthError: MockCustomerAuthError,
  CustomerAuthValidationError: MockCustomerAuthValidationError,
  CustomerAuthInvalidOtpError: MockCustomerAuthInvalidOtpError,
  CustomerAuthExpiredOtpError: MockCustomerAuthExpiredOtpError,
  requestCustomerOtp,
  verifyCustomerOtp,
  getAuthenticatedCustomerSession,
  signOutCustomerSession,
}));

describe('customer auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSmsProvider.mockReturnValue({ sendOtp: vi.fn() });
  });

  it('requests an OTP with calm success copy', async () => {
    const { POST } = await import('@/app/api/customer-auth/request-otp/route');
    requestCustomerOtp.mockResolvedValue({
      phoneNumber: '+56912345678',
      expiresAt: '2026-03-22T10:10:00.000Z',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/customer-auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '+56912345678' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(requestCustomerOtp).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { phoneNumber: '+56912345678' },
    );
    expect(payload.message).toBe('Te enviamos un código por SMS.');
  });

  it('verifies an OTP, sets the auth cookie, and returns the wallet summary', async () => {
    const { POST } = await import('@/app/api/customer-auth/verify-otp/route');
    verifyCustomerOtp.mockResolvedValue({
      customer: { id: 'customer-1', phoneNumber: '+56912345678' },
      sessionToken: 'session-token',
    });
    getWalletSummary.mockResolvedValue({
      wallet: { id: 'wallet-1', customerIdentifier: 'customer-1', currencyCode: 'CLP' },
      currentBalance: 8500,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/customer-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '+56912345678', code: '123456' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(setCustomerSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({ cookies: expect.anything() }),
      'session-token',
    );
    expect(getWalletSummary).toHaveBeenCalledWith(expect.anything(), 'customer-1');
    expect(payload.walletSummary.currentBalance).toBe(8500);
  });

  it('returns the current authenticated session when present', async () => {
    const { GET } = await import('@/app/api/customer-auth/session/route');
    getAuthenticatedCustomerSession.mockResolvedValue({
      customer: { id: 'customer-1', phoneNumber: '+56912345678' },
      session: { id: 'session-1' },
    });
    getWalletSummary.mockResolvedValue({
      wallet: { id: 'wallet-1', customerIdentifier: 'customer-1', currencyCode: 'CLP' },
      currentBalance: 10000,
    });

    const response = await GET(new NextRequest('http://localhost/api/customer-auth/session'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      authenticated: true,
      customer: { id: 'customer-1', phoneNumber: '+56912345678' },
      walletSummary: {
        wallet: { id: 'wallet-1', customerIdentifier: 'customer-1', currencyCode: 'CLP' },
        currentBalance: 10000,
      },
    });
  });

  it('clears the cookie when the customer is signed out or no longer authenticated', async () => {
    const sessionRoute = await import('@/app/api/customer-auth/session/route');
    getAuthenticatedCustomerSession.mockResolvedValue(null);

    const sessionResponse = await sessionRoute.GET(
      new NextRequest('http://localhost/api/customer-auth/session'),
    );
    const sessionPayload = await sessionResponse.json();

    expect(sessionResponse.status).toBe(200);
    expect(sessionPayload.authenticated).toBe(false);
    expect(clearCustomerSessionCookie).toHaveBeenCalled();

    const logoutRoute = await import('@/app/api/customer-auth/logout/route');
    const logoutResponse = await logoutRoute.POST(
      new NextRequest('http://localhost/api/customer-auth/logout', { method: 'POST' }),
    );

    expect(logoutResponse.status).toBe(200);
    expect(signOutCustomerSession).toHaveBeenCalled();
    expect(clearCustomerSessionCookie).toHaveBeenCalledTimes(2);
  });

  it('maps invalid and expired OTP errors to user-safe statuses', async () => {
    const { POST } = await import('@/app/api/customer-auth/verify-otp/route');

    verifyCustomerOtp.mockRejectedValueOnce(
      new MockCustomerAuthInvalidOtpError('Ese código no coincide. Revisa el mensaje e intenta otra vez.'),
    );
    let response = await POST(
      new NextRequest('http://localhost/api/customer-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '+56912345678', code: '000000' }),
      }),
    );
    expect(response.status).toBe(401);

    verifyCustomerOtp.mockRejectedValueOnce(
      new MockCustomerAuthExpiredOtpError('Ese código ya venció. Pide uno nuevo para continuar.'),
    );
    response = await POST(
      new NextRequest('http://localhost/api/customer-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '+56912345678', code: '111111' }),
      }),
    );
    expect(response.status).toBe(410);
  });
});
