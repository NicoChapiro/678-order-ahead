import { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getInternalSecurityEnv = vi.fn();
const getDatabaseEnv = vi.fn();
const bootstrapOwnerIfNeeded = vi.fn();

vi.mock('@/server/env', () => ({
  getInternalSecurityEnv,
  getDatabaseEnv,
}));

vi.mock('@/server/modules/staff-auth/bootstrap', () => ({
  bootstrapOwnerIfNeeded,
}));

describe('internal bootstrap owner route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInternalSecurityEnv.mockReturnValue({ INTERNAL_API_SECRET: 'super-secret' });
    getDatabaseEnv.mockReturnValue({ DATABASE_URL: 'https://db.example.com' });
  });

  it('returns 401 when the internal secret header is missing', async () => {
    const { POST } = await import('@/app/api/internal/bootstrap-owner/route');

    const request = new NextRequest('http://localhost/api/internal/bootstrap-owner', {
      method: 'POST',
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(bootstrapOwnerIfNeeded).not.toHaveBeenCalled();
  });

  it('creates the first owner when authorized and no owner exists', async () => {
    const { POST } = await import('@/app/api/internal/bootstrap-owner/route');

    bootstrapOwnerIfNeeded.mockResolvedValue({ created: true });

    const request = new NextRequest('http://localhost/api/internal/bootstrap-owner', {
      method: 'POST',
      headers: {
        'x-internal-secret': 'super-secret',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, created: true });
  });

  it('returns a safe skipped response when an owner already exists', async () => {
    const { POST } = await import('@/app/api/internal/bootstrap-owner/route');

    bootstrapOwnerIfNeeded.mockResolvedValue({ created: false, reason: 'owner_exists' });

    const request = new NextRequest('http://localhost/api/internal/bootstrap-owner', {
      method: 'POST',
      headers: {
        'x-internal-secret': 'super-secret',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      created: false,
      reason: 'owner_exists',
    });
  });

  it('returns a safe configuration error when required env is missing', async () => {
    const { POST } = await import('@/app/api/internal/bootstrap-owner/route');

    getDatabaseEnv.mockImplementation(() => {
      throw new ZodError([]);
    });

    const request = new NextRequest('http://localhost/api/internal/bootstrap-owner', {
      method: 'POST',
      headers: {
        'x-internal-secret': 'super-secret',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Server configuration error.',
    });
  });
});
