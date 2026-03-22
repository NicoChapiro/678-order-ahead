import {
  buildOrderActionFeedback,
  countRecentRejectedOrders,
  getPendingAcceptancePreventionMessages,
} from '@/app/(admin)/admin/order-workflow';

describe('admin order workflow helpers', () => {
  it('counts only recent rejected orders inside the time window', () => {
    const recentIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const staleIso = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    const result = countRecentRejectedOrders([
      {
        id: 'order-1',
        status: 'rejected',
        placedAt: recentIso,
        items: [],
      },
      {
        id: 'order-2',
        status: 'accepted',
        placedAt: recentIso,
        items: [],
      },
      {
        id: 'order-3',
        status: 'rejected',
        placedAt: staleIso,
        items: [],
      },
    ]);

    expect(result).toBe(1);
  });

  it('adds stronger prevention guidance when order-ahead stays active with repeated rejects', () => {
    const messages = getPendingAcceptancePreventionMessages({
      isOrderAheadEnabled: true,
      repeatedRecentRejects: 3,
    });

    expect(messages).toContain(
      'Acepta si el pedido todavía puede prepararse dentro del flujo normal.',
    );
    expect(messages).toContain(
      'Si rechazas pero order-ahead sigue activo, pueden seguir entrando pedidos evitables.',
    );
    expect(messages.at(-1)).toContain('3 rechazos recientes');
  });

  it('builds operational feedback with the resulting order status and notification summary', () => {
    const message = buildOrderActionFeedback('aceptar la orden', {
      transitionApplied: true,
      order: { id: 'order-9', status: 'accepted' },
      event: { eventType: 'order_accepted' },
      notification: {
        notificationType: 'order_accepted',
        status: 'sent',
        attemptCount: 1,
      },
    });

    expect(message).toContain('Orden order-9 actualizada correctamente tras aceptar la orden.');
    expect(message).toContain('Estado actual: Aceptada.');
    expect(message).toContain('Notificación de aceptación enviada');
  });
});
