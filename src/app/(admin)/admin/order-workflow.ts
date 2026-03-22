export type AdminWorkflowOrder = {
  id: string;
  status: string;
  placedAt: string;
  items: Array<{
    id: string;
    itemNameSnapshot: string;
    quantity: number;
  }>;
};

export type AdminWorkflowNotification = {
  notificationType: string;
  status: string;
  attemptCount: number;
};

export function getAdminOrderStatusLabel(status: string) {
  switch (status) {
    case 'pending_acceptance':
      return 'Pendiente';
    case 'accepted':
      return 'Aceptada';
    case 'rejected':
      return 'Rechazada';
    case 'cancelled_by_customer':
      return 'Cancelada';
    case 'ready_for_pickup':
      return 'Lista';
    case 'completed':
      return 'Completada';
    case 'no_show':
      return 'No-show';
    default:
      return status;
  }
}

export function getAdminNotificationTypeLabel(notificationType: string) {
  switch (notificationType) {
    case 'order_accepted':
      return 'Aceptación';
    case 'order_rejected':
      return 'Rechazo';
    case 'order_ready':
      return 'Lista para retiro';
    case 'order_completed':
      return 'Completada';
    case 'order_cancelled':
      return 'Cancelación cliente';
    case 'order_no_show':
      return 'No-show';
    default:
      return notificationType;
  }
}

export function getAdminNotificationStatusLabel(status: string) {
  switch (status) {
    case 'sent':
      return 'Enviada';
    case 'failed':
      return 'Fallida';
    case 'pending':
      return 'Pendiente';
    case 'skipped':
      return 'Omitida';
    default:
      return status;
  }
}

export function buildOrderActionFeedback(
  action: string,
  payload: {
    transitionApplied?: boolean;
    order?: { id?: string; status?: string } | null;
    event?: { eventType?: string | null } | null;
    notification?: AdminWorkflowNotification | null;
  },
) {
  const orderId = payload.order?.id ? `Orden ${payload.order.id}` : 'La orden';
  const statusLabel = payload.order?.status
    ? ` Estado actual: ${getAdminOrderStatusLabel(payload.order.status)}.`
    : '';

  const actionOutcome =
    payload.transitionApplied === false
      ? `${orderId} ya estaba en el estado esperado; se refrescó la vista operativa.`
      : `${orderId} actualizada correctamente tras ${action}.`;

  const eventSummary = payload.event?.eventType
    ? ` Evento: ${payload.event.eventType}.`
    : ' Sin evento adicional.';

  const notificationSummary = payload.notification
    ? ` Notificación de ${getAdminNotificationTypeLabel(payload.notification.notificationType).toLowerCase()} ${getAdminNotificationStatusLabel(payload.notification.status).toLowerCase()} (intentos: ${payload.notification.attemptCount}).`
    : ' Sin notificación asociada.';

  return `${actionOutcome}${statusLabel}${eventSummary}${notificationSummary}`;
}

export function countRecentRejectedOrders(orders: AdminWorkflowOrder[], hours = 2) {
  const now = Date.now();
  const windowMs = hours * 60 * 60 * 1000;

  return orders.filter((order) => {
    if (order.status !== 'rejected') {
      return false;
    }

    const placedAtMs = new Date(order.placedAt).getTime();
    return Number.isFinite(placedAtMs) && now - placedAtMs <= windowMs;
  }).length;
}

export function getPendingAcceptancePreventionMessages(input: {
  isOrderAheadEnabled: boolean;
  repeatedRecentRejects: number;
}) {
  const messages = [
    'Acepta si el pedido todavía puede prepararse dentro del flujo normal.',
    'Pausa order-ahead si la causa afecta a toda la tienda.',
    'Marca productos sin stock en menú si el problema es de uno o pocos ítems.',
  ];

  if (input.isOrderAheadEnabled) {
    messages.push(
      'Si rechazas pero order-ahead sigue activo, pueden seguir entrando pedidos evitables.',
    );
  }

  if (input.repeatedRecentRejects >= 2) {
    messages.push(
      `Ya hubo ${input.repeatedRecentRejects} rechazos recientes en esta vista: revisa si corresponde una pausa temporal antes de seguir rechazando.`,
    );
  }

  return messages;
}
