import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginStaffUser = vi.fn();
const getRequiredStaffSession = vi.fn();

vi.mock('@/server/env', () => ({
  getBootstrapEnv: () => ({ NODE_ENV: 'test' }),
}));

vi.mock('@/server/modules/staff-auth/login', () => ({
  StaffLoginError: class StaffLoginError extends Error {},
  loginStaffUser,
}));

vi.mock('@/server/modules/staff-auth/service', () => ({
  StaffAuthError: class StaffAuthError extends Error {},
  getStaffSessionCookieName: () => 'staff_session',
  getRequiredStaffSession,
}));

vi.mock('@/server/modules/stores/repository', () => ({
  storeAvailabilityRepository: {},
}));

vi.mock('@/server/modules/stores/service', () => ({
  OrderAheadPermissionError: class OrderAheadPermissionError extends Error {},
  OrderAheadValidationError: class OrderAheadValidationError extends Error {},
  StoreNotFoundError: class StoreNotFoundError extends Error {},
  getAdminOrderAheadOverview: vi.fn().mockResolvedValue({
    availability: { storeCode: 'store_1', isOrderAheadEnabled: true },
    recentHistory: [],
  }),
  updateOrderAheadAvailability: vi.fn(),
}));

describe('admin auth session integration path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows protected admin route access with cookie issued by login', async () => {
    loginStaffUser.mockResolvedValue({
      user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner', role: 'owner' },
      session: { token: 'token-1', expiresAt: new Date('2030-01-01T00:00:00.000Z') },
    });

    getRequiredStaffSession.mockImplementation(async (request: NextRequest) => {
      const token = request.cookies.get('staff_session')?.value;
      if (token !== 'token-1') {
        const { StaffAuthError } = await import('@/server/modules/staff-auth/service');
        throw new StaffAuthError('Authentication required.');
      }

      return {
        staffUserId: 'owner-1',
        email: 'owner@example.com',
        name: 'Owner',
        role: 'owner',
      };
    });

    const { POST: loginPost } = await import('@/app/api/admin/auth/login/route');
    const loginRequest = new NextRequest('http://localhost/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com', password: 'pass12345' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const loginResponse = await loginPost(loginRequest);
    expect(loginResponse.status).toBe(200);

    const sessionCookie = loginResponse.cookies.get('staff_session');
    expect(sessionCookie?.value).toBe('token-1');

    const { GET: orderAheadGet } = await import('@/app/api/admin/stores/[storeCode]/order-ahead/route');
    const protectedRequest = new NextRequest('http://localhost/api/admin/stores/store_1/order-ahead', {
      headers: {
        cookie: `staff_session=${sessionCookie?.value}`,
      },
    });

    const protectedResponse = await orderAheadGet(protectedRequest, {
      params: Promise.resolve({ storeCode: 'store_1' }),
    });

    expect(protectedResponse.status).toBe(200);
  });
});
