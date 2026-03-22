import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRequiredStaffSession = vi.fn();
const acceptOrder = vi.fn();
const rejectOrder = vi.fn();
const markOrderReadyForPickup = vi.fn();
const completeOrder = vi.fn();
const markOrderNoShow = vi.fn();
const retryOrderNotification = vi.fn();
const getOrderDetail = vi.fn();
const listAdminOrders = vi.fn();

vi.mock('@/server/modules/staff-auth/service', () => ({
  StaffAuthError: class StaffAuthError extends Error {},
  getRequiredStaffSession,
}));

vi.mock('@/server/modules/orders/repository', () => ({
  orderRepository: {},
}));

vi.mock('@/server/modules/orders/service', () => ({
  InvalidOrderStateTransitionError: class InvalidOrderStateTransitionError extends Error {},
  OrderNotFoundError: class OrderNotFoundError extends Error {},
  OrderNotificationRetryError: class OrderNotificationRetryError extends Error {},
  OrderValidationError: class OrderValidationError extends Error {},
  acceptOrder,
  rejectOrder,
  markOrderReadyForPickup,
  completeOrder,
  markOrderNoShow,
  retryOrderNotification,
  getOrderDetail,
  listAdminOrders,
}));

describe('admin order routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequiredStaffSession.mockResolvedValue({
      staffUserId: 'staff-123',
      role: 'barista',
    });
  });

  it('accept route passes actor info and returns transition metadata', async () => {
    const { POST } = await import('@/app/api/admin/orders/[orderId]/accept/route');
    acceptOrder.mockResolvedValue({
      order: { id: 'order-1', status: 'accepted' },
      transitionApplied: true,
      event: { eventType: 'order_accepted' },
      notification: { notificationType: 'order_accepted', status: 'sent', attemptCount: 1 },
    });

    const response = await POST(
      new NextRequest('http://localhost/api/admin/orders/order-1/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ orderId: 'order-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(acceptOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: 'order-1', actorUserId: 'staff-123', actorRole: 'barista' }),
    );
    expect(payload.transitionApplied).toBe(true);
  });

  it('reject route validates reason', async () => {
    const { POST } = await import('@/app/api/admin/orders/[orderId]/reject/route');

    const response = await POST(
      new NextRequest('http://localhost/api/admin/orders/order-1/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '' }),
      }),
      { params: Promise.resolve({ orderId: 'order-1' }) },
    );

    expect(response.status).toBe(400);
    expect(rejectOrder).not.toHaveBeenCalled();
  });

  it('no-show route validates reason', async () => {
    const { POST } = await import('@/app/api/admin/orders/[orderId]/no-show/route');

    const response = await POST(
      new NextRequest('http://localhost/api/admin/orders/order-1/no-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ orderId: 'order-1' }) },
    );

    expect(response.status).toBe(400);
    expect(markOrderNoShow).not.toHaveBeenCalled();
  });

  it('retry route forwards order and notification ids', async () => {
    const { POST } = await import(
      '@/app/api/admin/orders/[orderId]/notifications/[notificationId]/retry/route'
    );
    retryOrderNotification.mockResolvedValue({
      order: { id: 'order-1', status: 'accepted' },
      transitionApplied: false,
      event: { eventType: 'order_accepted' },
      notification: {
        id: 'notification-1',
        notificationType: 'order_accepted',
        status: 'sent',
        attemptCount: 2,
      },
    });

    const response = await POST(
      new NextRequest('http://localhost/api/admin/orders/order-1/notifications/notification-1/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ orderId: 'order-1', notificationId: 'notification-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(retryOrderNotification).toHaveBeenCalledWith(expect.anything(), {
      orderId: 'order-1',
      notificationId: 'notification-1',
    });
    expect(payload.notification.attemptCount).toBe(2);
  });

  it('store orders route forwards status filter and returns route metadata', async () => {
    const { GET } = await import('@/app/api/admin/stores/[storeCode]/orders/route');
    listAdminOrders.mockResolvedValue([
      {
        id: 'order-1',
        status: 'accepted',
        acceptedAt: '2026-01-01T00:00:00.000Z',
        lastEvent: { eventType: 'order_accepted', createdAt: '2026-01-01T00:00:00.000Z' },
      },
    ]);

    const response = await GET(
      new NextRequest('http://localhost/api/admin/stores/store_1/orders?status=accepted'),
      { params: Promise.resolve({ storeCode: 'store_1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listAdminOrders).toHaveBeenCalledWith(expect.anything(), 'store_1', 'accepted');
    expect(payload.appliedFilter).toEqual({ status: 'accepted' });
    expect(payload.orders[0].lastEvent.eventType).toBe('order_accepted');
  });

  it('admin order detail route returns expanded order metadata', async () => {
    const { GET } = await import('@/app/api/admin/orders/[orderId]/route');
    getOrderDetail.mockResolvedValue({
      id: 'order-1',
      status: 'ready_for_pickup',
      acceptedAt: '2026-01-01T00:01:00.000Z',
      readyAt: '2026-01-01T00:05:00.000Z',
      lastEvent: { eventType: 'order_ready', createdAt: '2026-01-01T00:05:00.000Z' },
      events: [{ eventType: 'order_ready', createdAt: '2026-01-01T00:05:00.000Z' }],
      notifications: [
        {
          notificationType: 'order_ready',
          status: 'sent',
          attemptCount: 1,
          updatedAt: '2026-01-01T00:05:05.000Z',
        },
      ],
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/orders/order-1'),
      { params: Promise.resolve({ orderId: 'order-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.order.lastEvent.eventType).toBe('order_ready');
    expect(payload.order.notifications[0].notificationType).toBe('order_ready');
    expect(payload.order.notifications[0].attemptCount).toBe(1);
  });
});
