import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginStaffUser = vi.fn();
const invalidateStaffSession = vi.fn();


vi.mock('@/server/modules/staff-auth/login', () => ({
  StaffLoginError: class StaffLoginError extends Error {},
  loginStaffUser,
}));

vi.mock('@/server/modules/staff-auth/service', () => ({
  getStaffSessionCookieName: () => 'staff_session',
  invalidateStaffSession,
}));

vi.mock('@/server/env', () => ({
  getBootstrapEnv: () => ({ NODE_ENV: 'test' }),
}));

describe('admin auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login succeeds and sets session cookie', async () => {
    const { POST } = await import('@/app/api/admin/auth/login/route');

    loginStaffUser.mockResolvedValue({
      user: { id: 'u1', email: 'owner@example.com', name: 'Owner', role: 'owner' },
      session: { token: 'token-1', expiresAt: new Date('2030-01-01T00:00:00.000Z') },
    });

    const request = new NextRequest('http://localhost/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com', password: 'pass12345' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.email).toBe('owner@example.com');
    expect(response.cookies.get('staff_session')?.value).toBe('token-1');
  });

  it('login fails with invalid credentials', async () => {
    const { POST } = await import('@/app/api/admin/auth/login/route');

    const { StaffLoginError } = await import('@/server/modules/staff-auth/login');
    loginStaffUser.mockRejectedValue(new StaffLoginError('Invalid credentials.'));

    const request = new NextRequest('http://localhost/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com', password: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('logout revokes existing session', async () => {
    const { POST } = await import('@/app/api/admin/auth/logout/route');

    const request = new NextRequest('http://localhost/api/admin/auth/logout', {
      method: 'POST',
      headers: { cookie: 'staff_session=token-1' },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(invalidateStaffSession).toHaveBeenCalledWith('token-1');
  });
});
