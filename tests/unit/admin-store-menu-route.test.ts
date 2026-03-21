import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRequiredStaffSession = vi.fn();
const getAdminStoreMenu = vi.fn();
const attachMenuItemToStore = vi.fn();
const updateStoreMenuItem = vi.fn();

vi.mock('@/server/modules/staff-auth/service', () => ({
  StaffAuthError: class StaffAuthError extends Error {},
  getRequiredStaffSession,
}));

vi.mock('@/server/modules/menu/repository', () => ({
  menuRepository: {},
}));

vi.mock('@/server/modules/menu/service', () => ({
  MenuConflictError: class MenuConflictError extends Error {},
  MenuNotFoundError: class MenuNotFoundError extends Error {},
  MenuValidationError: class MenuValidationError extends Error {},
  getAdminStoreMenu,
  attachMenuItemToStore,
  updateStoreMenuItem,
}));

describe('admin store menu routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated access for menu overview', async () => {
    const { GET } = await import('@/app/api/admin/stores/[storeCode]/menu/route');
    const { StaffAuthError } = await import('@/server/modules/staff-auth/service');

    getRequiredStaffSession.mockRejectedValue(new StaffAuthError('Authentication required.'));

    const request = new NextRequest('http://localhost/api/admin/stores/store_1/menu');
    const response = await GET(request, { params: Promise.resolve({ storeCode: 'store_1' }) });

    expect(response.status).toBe(401);
  });

  it('rejects invalid price when attaching item to store', async () => {
    const { POST } = await import('@/app/api/admin/stores/[storeCode]/menu/route');

    getRequiredStaffSession.mockResolvedValue({ staffUserId: 'staff-1', role: 'owner' });

    const request = new NextRequest('http://localhost/api/admin/stores/store_1/menu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        menuItemId: '2f502fff-a34f-4acc-89ef-0bcd0d4d1c86',
        priceAmount: 0,
        currencyCode: 'CLP',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ storeCode: 'store_1' }) });
    expect(response.status).toBe(400);
    expect(attachMenuItemToStore).not.toHaveBeenCalled();
  });

  it('updates an attached store menu item', async () => {
    const { PATCH } = await import('@/app/api/admin/stores/[storeCode]/menu/[menuItemId]/route');

    getRequiredStaffSession.mockResolvedValue({ staffUserId: 'staff-1', role: 'owner' });
    updateStoreMenuItem.mockResolvedValue({ menuItemId: '2f502fff-a34f-4acc-89ef-0bcd0d4d1c86' });

    const request = new NextRequest(
      'http://localhost/api/admin/stores/store_1/menu/2f502fff-a34f-4acc-89ef-0bcd0d4d1c86',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceAmount: 3200,
          currencyCode: 'CLP',
          isVisible: true,
          isInStock: false,
        }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({
        storeCode: 'store_1',
        menuItemId: '2f502fff-a34f-4acc-89ef-0bcd0d4d1c86',
      }),
    });

    expect(response.status).toBe(200);
    expect(updateStoreMenuItem).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        storeCode: 'store_1',
        menuItemId: '2f502fff-a34f-4acc-89ef-0bcd0d4d1c86',
        priceAmount: 3200,
        isVisible: true,
        isInStock: false,
      }),
    );
  });
});
