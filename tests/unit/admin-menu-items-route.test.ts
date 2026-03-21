import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRequiredStaffSession = vi.fn();
const createBaseMenuItem = vi.fn();

vi.mock('@/server/modules/staff-auth/service', () => ({
  StaffAuthError: class StaffAuthError extends Error {},
  getRequiredStaffSession,
}));

vi.mock('@/server/modules/menu/repository', () => ({
  menuRepository: {},
}));

vi.mock('@/server/modules/menu/service', () => ({
  MenuConflictError: class MenuConflictError extends Error {},
  MenuValidationError: class MenuValidationError extends Error {},
  createBaseMenuItem,
}));

describe('admin menu items route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a base menu item for authenticated staff', async () => {
    const { POST } = await import('@/app/api/admin/menu-items/route');

    getRequiredStaffSession.mockResolvedValue({ staffUserId: 'staff-1', role: 'owner' });
    createBaseMenuItem.mockResolvedValue({ code: 'mocha' });

    const request = new NextRequest('http://localhost/api/admin/menu-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'mocha',
        name: 'Mocha',
        description: 'Chocolate espresso drink',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(createBaseMenuItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ code: 'mocha', name: 'Mocha' }),
    );
  });
});
