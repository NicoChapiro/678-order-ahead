import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRequiredStaffSession = vi.fn();
const updateOrderAheadAvailability = vi.fn();
const getAdminOrderAheadOverview = vi.fn();

vi.mock('@/server/modules/staff-auth/service', () => ({
  StaffAuthError: class StaffAuthError extends Error {},
  getRequiredStaffSession,
}));

vi.mock('@/server/modules/stores/repository', () => ({
  storeAvailabilityRepository: {},
}));

vi.mock('@/server/modules/stores/service', () => ({
  OrderAheadPermissionError: class OrderAheadPermissionError extends Error {},
  OrderAheadValidationError: class OrderAheadValidationError extends Error {},
  StoreNotFoundError: class StoreNotFoundError extends Error {},
  getAdminOrderAheadOverview,
  updateOrderAheadAvailability,
}));

describe('admin order-ahead route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated access', async () => {
    const { GET } = await import('@/app/api/admin/stores/[storeCode]/order-ahead/route');

    const { StaffAuthError } = await import('@/server/modules/staff-auth/service');
    getRequiredStaffSession.mockRejectedValue(new StaffAuthError('Authentication required.'));

    const request = new NextRequest('http://localhost/api/admin/stores/store_1/order-ahead');
    const response = await GET(request, { params: Promise.resolve({ storeCode: 'store_1' }) });

    expect(response.status).toBe(401);
  });

  it('uses session actor instead of request headers', async () => {
    const { POST } = await import('@/app/api/admin/stores/[storeCode]/order-ahead/route');

    getRequiredStaffSession.mockResolvedValue({
      staffUserId: 'staff-123',
      role: 'owner',
    });
    updateOrderAheadAvailability.mockResolvedValue({ isOrderAheadEnabled: true });

    const request = new NextRequest('http://localhost/api/admin/stores/store_1/order-ahead', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-user-id': 'attacker',
        'x-actor-role': 'customer',
      },
      body: JSON.stringify({ newIsEnabled: true }),
    });

    const response = await POST(request, { params: Promise.resolve({ storeCode: 'store_1' }) });

    expect(response.status).toBe(200);
    expect(updateOrderAheadAvailability).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorUserId: 'staff-123', actorRole: 'owner' }),
    );
  });
});
