import type { StoreCode } from '@/server/modules/stores/types';
import {
  createOrderPaymentDebit,
  createReferenceReversal,
  WalletConflictError,
  WalletInsufficientFundsError,
} from '@/server/modules/wallet/service';
import type {
  OrderActionResult,
  OrderActorRole,
  OrderDetail,
  OrderEventRecord,
  OrderEventType,
  OrderItemSelectionInput,
  OrderNoShowResult,
  OrderNotificationRecord,
  OrderNotificationType,
  OrderRepository,
  OrderStatus,
} from '@/server/modules/orders/types';

export class OrderNotFoundError extends Error {}
export class OrderAheadUnavailableError extends Error {}
export class MenuItemUnavailableError extends Error {}
export class OrderInsufficientFundsError extends Error {}
export class InvalidOrderStateTransitionError extends Error {}
export class CancellationWindowExpiredError extends Error {}
export class OrderValidationError extends Error {}
export class OrderNotificationRetryError extends Error {}

const FIXED_ORDER_CURRENCY = 'CLP' as const;
const CUSTOMER_CANCELLATION_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_INTERNAL_NOTIFICATION_STATUS = 'pending' as const;

function normalizeCustomerIdentifier(customerIdentifier: string) {
  const normalized = customerIdentifier.trim();

  if (!normalized) {
    throw new OrderValidationError('Customer key is required.');
  }

  if (normalized.length > 120) {
    throw new OrderValidationError('Customer key must be 120 characters or fewer.');
  }

  return normalized;
}

function normalizeOptionalReason(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function requireReason(value: string | undefined | null, message: string) {
  const normalized = normalizeOptionalReason(value);
  if (!normalized) {
    throw new OrderValidationError(message);
  }

  return normalized;
}

function validateQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new OrderValidationError('Quantities must be positive integers.');
  }
}

function assertCurrentState(current: OrderStatus, allowedCurrentStates: OrderStatus[], next: OrderStatus) {
  if (!allowedCurrentStates.includes(current)) {
    throw new InvalidOrderStateTransitionError(
      `Cannot move order from '${current}' to '${next}'.`,
    );
  }
}

function ensureOrder(order: OrderDetail | null): OrderDetail {
  if (!order) {
    throw new OrderNotFoundError('Order was not found.');
  }

  return order;
}

function buildNotificationPayload(order: OrderDetail, extras?: Record<string, unknown>) {
  return {
    orderId: order.id,
    orderStatus: order.status,
    storeId: order.storeId,
    storeCode: order.storeCode,
    storeName: order.storeName,
    totalAmount: order.totalAmount,
    customerIdentifier: order.customerIdentifier,
    ...extras,
  };
}

async function processInternalNotification(
  repository: OrderRepository,
  notification: OrderNotificationRecord,
): Promise<OrderNotificationRecord> {
  const processedAt = new Date().toISOString();
  const attemptCount = notification.attemptCount + 1;
  const payload = notification.payloadJson ?? {};

  const requiredFields = ['orderId', 'storeCode', 'customerIdentifier'] as const;
  const missingFields = requiredFields.filter(
    (field) => typeof payload[field] !== 'string' || payload[field].trim().length === 0,
  );

  if (missingFields.length > 0) {
    return (await repository.updateOrderNotification({
      notificationId: notification.id,
      status: 'failed',
      failureReason: `Missing required notification payload fields: ${missingFields.join(', ')}.`,
      attemptCount,
      processedAt,
      updatedAt: processedAt,
    })) as OrderNotificationRecord;
  }

  return (await repository.updateOrderNotification({
    notificationId: notification.id,
    status: 'sent',
    failureReason: null,
    attemptCount,
    processedAt,
    updatedAt: processedAt,
  })) as OrderNotificationRecord;
}

async function createOrderEventAndNotification(
  repository: OrderRepository,
  input: {
    order: OrderDetail;
    actedAt: string;
    eventType: OrderEventType;
    notificationType?: OrderNotificationType;
    actorUserId?: string | null;
    actorRole?: OrderActorRole | null;
    metadataJson?: Record<string, unknown> | null;
    notificationPayload?: Record<string, unknown> | null;
  },
): Promise<{ event: OrderEventRecord; notification: OrderNotificationRecord | null }> {
  const event = await repository.createOrderEvent({
    orderId: input.order.id,
    eventType: input.eventType,
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    metadataJson: input.metadataJson ?? null,
    createdAt: input.actedAt,
  });

  if (!input.notificationType) {
    return { event, notification: null };
  }

  const createdNotification = await repository.createOrderNotification({
    orderId: input.order.id,
    notificationType: input.notificationType,
    channel: 'internal',
    status: DEFAULT_INTERNAL_NOTIFICATION_STATUS,
    recipientCustomerIdentifier: input.order.customerIdentifier,
    payloadJson: input.notificationPayload ?? buildNotificationPayload(input.order),
    createdAt: input.actedAt,
    updatedAt: input.actedAt,
  });

  const processedNotification = await processInternalNotification(repository, createdNotification);

  return { event, notification: processedNotification };
}

async function reverseOrderPayment(
  repository: OrderRepository,
  order: OrderDetail,
  note: string,
  actorUserId?: string,
  actorRole?: 'owner' | 'barista' | 'system',
) {
  try {
    await createReferenceReversal(repository, {
      customerIdentifier: order.customerIdentifier,
      referenceType: 'order',
      referenceId: order.id,
      actorUserId,
      actorRole,
      note,
    });
  } catch (error) {
    if (error instanceof WalletConflictError) {
      return false;
    }

    throw error;
  }

  return true;
}

async function reloadActionResult(
  repository: OrderRepository,
  orderId: string,
  transitionApplied: boolean,
  event: OrderEventRecord | null,
  notification: OrderNotificationRecord | null,
): Promise<OrderActionResult> {
  return {
    order: ensureOrder(await repository.getOrderById(orderId)),
    transitionApplied,
    event,
    notification,
  };
}

function ensureRetryableNotification(order: OrderDetail, notificationId: string) {
  const notification = order.notifications.find((entry) => entry.id === notificationId) ?? null;

  if (!notification) {
    throw new OrderNotFoundError('Notification was not found for this order.');
  }

  if (notification.status !== 'failed') {
    throw new OrderNotificationRetryError(
      `Notification '${notification.id}' cannot be retried from status '${notification.status}'.`,
    );
  }

  return notification;
}

export async function createOrder(
  repository: OrderRepository,
  input: {
    customerIdentifier: string;
    storeCode: StoreCode;
    items: OrderItemSelectionInput[];
  },
) {
  const customerIdentifier = normalizeCustomerIdentifier(input.customerIdentifier);

  if (input.items.length === 0) {
    throw new OrderValidationError('Orders must include at least one item.');
  }

  const quantityByMenuItemId = new Map<string, number>();
  for (const item of input.items) {
    validateQuantity(item.quantity);
    quantityByMenuItemId.set(item.menuItemId, (quantityByMenuItemId.get(item.menuItemId) ?? 0) + item.quantity);
  }

  const store = await repository.getStoreOrderContext(input.storeCode);
  if (!store) {
    throw new OrderNotFoundError(`Store '${input.storeCode}' was not found.`);
  }

  if (!store.isOrderAheadEnabled) {
    throw new OrderAheadUnavailableError('Order-ahead is currently unavailable for this store.');
  }

  const menuItemIds = [...quantityByMenuItemId.keys()];
  const availableRows = await repository.listStoreOrderMenuItems(input.storeCode, menuItemIds);

  if (availableRows.length !== menuItemIds.length) {
    throw new MenuItemUnavailableError('One or more selected menu items are unavailable at this store.');
  }

  const lineItems = availableRows.map((row) => {
    if (!row.baseIsActive || !row.isVisible || !row.isInStock) {
      throw new MenuItemUnavailableError(`Menu item '${row.itemName}' is unavailable.`);
    }

    const quantity = quantityByMenuItemId.get(row.menuItemId) ?? 0;
    const lineTotalAmount = row.priceAmount * quantity;

    return {
      menuItemId: row.menuItemId,
      storeMenuItemId: row.storeMenuItemId,
      itemNameSnapshot: row.itemName,
      unitPriceAmount: row.priceAmount,
      quantity,
      lineTotalAmount,
    };
  });

  const totalAmount = lineItems.reduce((sum, item) => sum + item.lineTotalAmount, 0);
  if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
    throw new OrderValidationError('Order total must be a positive integer.');
  }

  try {
    return await repository.runInTransaction(async (tx) => {
      const placedAt = new Date().toISOString();
      const order = await tx.createOrder({
        customerIdentifier,
        storeId: store.storeId,
        status: 'pending_acceptance',
        currencyCode: FIXED_ORDER_CURRENCY,
        totalAmount,
        placedAt,
      });

      await tx.createOrderItems(
        lineItems.map((item) => ({
          orderId: order.id,
          ...item,
        })),
      );

      await createOrderPaymentDebit(tx, {
        customerIdentifier,
        amount: totalAmount,
        orderReferenceId: order.id,
        actorRole: 'system',
        note: `Wallet debit for order ${order.id}`,
      });

      const fullOrder = ensureOrder(await tx.getOrderById(order.id));
      await tx.createOrderEvent({
        orderId: fullOrder.id,
        eventType: 'order_created',
        actorRole: 'customer',
        metadataJson: buildNotificationPayload(fullOrder, { source: 'customer_order_creation' }),
        createdAt: placedAt,
      });

      return ensureOrder(await tx.getOrderById(order.id));
    });
  } catch (error) {
    if (error instanceof WalletInsufficientFundsError) {
      throw new OrderInsufficientFundsError(error.message);
    }

    throw error;
  }
}

export async function listCustomerOrders(repository: OrderRepository, customerIdentifier: string) {
  return repository.listCustomerOrders(normalizeCustomerIdentifier(customerIdentifier));
}

export async function listAdminOrders(
  repository: OrderRepository,
  storeCode: StoreCode,
  status?: OrderStatus,
) {
  return repository.listAdminOrders(storeCode, status);
}

export async function getOrderDetail(repository: OrderRepository, orderId: string) {
  return ensureOrder(await repository.getOrderById(orderId));
}

async function transitionOrder(
  repository: OrderRepository,
  input: {
    orderId: string;
    targetStatus: OrderStatus;
    allowedCurrentStates: OrderStatus[];
    eventType: OrderEventType;
    notificationType?: OrderNotificationType;
    actorUserId?: string;
    actorRole?: OrderActorRole;
    rejectionReason?: string | null;
    cancellationReason?: string | null;
    metadataJson?: Record<string, unknown> | null;
  },
): Promise<OrderActionResult> {
  return repository.runInTransaction(async (tx) => {
    const order = ensureOrder(await tx.getOrderById(input.orderId));

    if (order.status === input.targetStatus) {
      return reloadActionResult(tx, order.id, false, order.lastEvent, order.notifications[0] ?? null);
    }

    assertCurrentState(order.status, input.allowedCurrentStates, input.targetStatus);

    const actedAt = new Date().toISOString();
    await tx.updateOrderStatus({
      orderId: order.id,
      status: input.targetStatus,
      actedAt,
      rejectionReason: input.rejectionReason,
      cancellationReason: input.cancellationReason,
    });

    const updatedOrder = ensureOrder(await tx.getOrderById(order.id));
    const { event, notification } = await createOrderEventAndNotification(tx, {
      order: updatedOrder,
      actedAt,
      eventType: input.eventType,
      notificationType: input.notificationType,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      metadataJson: {
        previousStatus: order.status,
        currentStatus: updatedOrder.status,
        ...input.metadataJson,
      },
      notificationPayload: buildNotificationPayload(updatedOrder, {
        previousStatus: order.status,
        reason: input.rejectionReason ?? input.cancellationReason ?? null,
      }),
    });

    return reloadActionResult(tx, order.id, true, event, notification);
  });
}

export async function acceptOrder(
  repository: OrderRepository,
  input: { orderId: string; actorUserId?: string; actorRole?: 'owner' | 'barista' },
) {
  return transitionOrder(repository, {
    orderId: input.orderId,
    targetStatus: 'accepted',
    allowedCurrentStates: ['pending_acceptance'],
    eventType: 'order_accepted',
    notificationType: 'order_accepted',
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
  });
}

export async function rejectOrder(
  repository: OrderRepository,
  input: { orderId: string; reason?: string; actorUserId?: string; actorRole?: 'owner' | 'barista' },
) {
  const rejectionReason = requireReason(input.reason, 'Rejection reason is required.');

  return repository.runInTransaction(async (tx) => {
    const order = ensureOrder(await tx.getOrderById(input.orderId));

    if (order.status === 'rejected') {
      return reloadActionResult(tx, order.id, false, order.lastEvent, order.notifications[0] ?? null);
    }

    assertCurrentState(order.status, ['pending_acceptance'], 'rejected');

    await reverseOrderPayment(
      tx,
      order,
      rejectionReason,
      input.actorUserId,
      input.actorRole ?? 'system',
    );

    const actedAt = new Date().toISOString();
    await tx.updateOrderStatus({
      orderId: order.id,
      status: 'rejected',
      actedAt,
      rejectionReason,
    });

    const updatedOrder = ensureOrder(await tx.getOrderById(order.id));
    const { event, notification } = await createOrderEventAndNotification(tx, {
      order: updatedOrder,
      actedAt,
      eventType: 'order_rejected',
      notificationType: 'order_rejected',
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      metadataJson: {
        previousStatus: order.status,
        currentStatus: updatedOrder.status,
        reason: rejectionReason,
        walletReversal: 'attempted_or_already_applied',
      },
      notificationPayload: buildNotificationPayload(updatedOrder, {
        previousStatus: order.status,
        reason: rejectionReason,
      }),
    });

    return reloadActionResult(tx, order.id, true, event, notification);
  });
}

export async function cancelOrderByCustomer(
  repository: OrderRepository,
  input: { orderId: string; reason?: string },
) {
  const cancellationReason =
    normalizeOptionalReason(input.reason) ?? 'Cancelled by customer within allowed window.';

  return repository.runInTransaction(async (tx) => {
    const order = ensureOrder(await tx.getOrderById(input.orderId));

    if (order.status === 'cancelled_by_customer') {
      return reloadActionResult(tx, order.id, false, order.lastEvent, order.notifications[0] ?? null);
    }

    assertCurrentState(order.status, ['pending_acceptance'], 'cancelled_by_customer');

    const placedAtMs = new Date(order.placedAt).getTime();
    if (Date.now() - placedAtMs > CUSTOMER_CANCELLATION_WINDOW_MS) {
      throw new CancellationWindowExpiredError('Customer cancellation window has expired.');
    }

    await reverseOrderPayment(tx, order, cancellationReason, order.customerIdentifier, 'system');

    const actedAt = new Date().toISOString();
    await tx.updateOrderStatus({
      orderId: order.id,
      status: 'cancelled_by_customer',
      actedAt,
      cancellationReason,
    });

    const updatedOrder = ensureOrder(await tx.getOrderById(order.id));
    const { event, notification } = await createOrderEventAndNotification(tx, {
      order: updatedOrder,
      actedAt,
      eventType: 'order_cancelled',
      notificationType: 'order_cancelled',
      actorUserId: order.customerIdentifier,
      actorRole: 'customer',
      metadataJson: {
        previousStatus: order.status,
        currentStatus: updatedOrder.status,
        reason: cancellationReason,
        walletReversal: 'attempted_or_already_applied',
      },
      notificationPayload: buildNotificationPayload(updatedOrder, {
        previousStatus: order.status,
        reason: cancellationReason,
      }),
    });

    return reloadActionResult(tx, order.id, true, event, notification);
  });
}

export async function markOrderReadyForPickup(
  repository: OrderRepository,
  input: { orderId: string; actorUserId?: string; actorRole?: 'owner' | 'barista' },
) {
  return transitionOrder(repository, {
    orderId: input.orderId,
    targetStatus: 'ready_for_pickup',
    allowedCurrentStates: ['accepted'],
    eventType: 'order_ready',
    notificationType: 'order_ready',
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
  });
}

export async function completeOrder(
  repository: OrderRepository,
  input: { orderId: string; actorUserId?: string; actorRole?: 'owner' | 'barista' },
) {
  return transitionOrder(repository, {
    orderId: input.orderId,
    targetStatus: 'completed',
    allowedCurrentStates: ['ready_for_pickup'],
    eventType: 'order_completed',
    notificationType: 'order_completed',
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
  });
}

export async function markOrderNoShow(
  repository: OrderRepository,
  input: { orderId: string; reason?: string; actorUserId?: string; actorRole?: 'owner' | 'barista' },
): Promise<OrderNoShowResult> {
  const noShowReason = requireReason(input.reason, 'No-show note is required.');

  return repository.runInTransaction(async (tx) => {
    const order = ensureOrder(await tx.getOrderById(input.orderId));

    if (order.status === 'no_show') {
      const customerFlags =
        (await tx.getCustomerOrderFlags(order.customerIdentifier)) ?? {
          customerIdentifier: order.customerIdentifier,
          noShowCount: 0,
          updatedAt: order.updatedAt,
        };

      const baseResult = await reloadActionResult(
        tx,
        order.id,
        false,
        order.lastEvent,
        order.notifications[0] ?? null,
      );

      return {
        ...baseResult,
        customerFlags,
      };
    }

    assertCurrentState(order.status, ['accepted', 'ready_for_pickup'], 'no_show');

    const actedAt = new Date().toISOString();
    await tx.updateOrderStatus({
      orderId: order.id,
      status: 'no_show',
      actedAt,
    });

    const customerFlags = await tx.incrementCustomerNoShowCount(order.customerIdentifier, actedAt);
    const updatedOrder = ensureOrder(await tx.getOrderById(order.id));
    const { event, notification } = await createOrderEventAndNotification(tx, {
      order: updatedOrder,
      actedAt,
      eventType: 'order_no_show',
      notificationType: 'order_no_show',
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      metadataJson: {
        previousStatus: order.status,
        currentStatus: updatedOrder.status,
        reason: noShowReason,
        noShowCount: customerFlags.noShowCount,
      },
      notificationPayload: buildNotificationPayload(updatedOrder, {
        previousStatus: order.status,
        reason: noShowReason,
        noShowCount: customerFlags.noShowCount,
      }),
    });

    return {
      ...(await reloadActionResult(tx, order.id, true, event, notification)),
      customerFlags,
    };
  });
}

export async function retryOrderNotification(
  repository: OrderRepository,
  input: { orderId: string; notificationId: string },
): Promise<OrderActionResult> {
  return repository.runInTransaction(async (tx) => {
    const order = ensureOrder(await tx.getOrderById(input.orderId));
    const notification = ensureRetryableNotification(order, input.notificationId);
    const retriedNotification = await processInternalNotification(tx, notification);

    return reloadActionResult(tx, order.id, false, order.lastEvent, retriedNotification);
  });
}
