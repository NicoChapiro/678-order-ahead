import type { StoreCode } from '@/server/modules/stores/types';
import {
  createOrderPaymentDebit,
  createReferenceReversal,
  WalletConflictError,
  WalletInsufficientFundsError,
} from '@/server/modules/wallet/service';
import type { OrderDetail, OrderItemSelectionInput, OrderRepository, OrderStatus } from '@/server/modules/orders/types';

export class OrderNotFoundError extends Error {}
export class OrderAheadUnavailableError extends Error {}
export class MenuItemUnavailableError extends Error {}
export class OrderInsufficientFundsError extends Error {}
export class InvalidOrderStateTransitionError extends Error {}
export class CancellationWindowExpiredError extends Error {}
export class OrderValidationError extends Error {}

const FIXED_ORDER_CURRENCY = 'CLP' as const;
const CUSTOMER_CANCELLATION_WINDOW_MS = 5 * 60 * 1000;

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

function normalizeReason(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
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

export async function listAdminOrders(repository: OrderRepository, storeCode: StoreCode) {
  return repository.listAdminOrders(storeCode);
}

export async function acceptOrder(
  repository: OrderRepository,
  input: { orderId: string },
) {
  const order = ensureOrder(await repository.getOrderById(input.orderId));
  assertCurrentState(order.status, ['pending_acceptance'], 'accepted');

  const updated = await repository.updateOrderStatus({
    orderId: order.id,
    status: 'accepted',
    actedAt: new Date().toISOString(),
  });

  return ensureOrder(updated ? await repository.getOrderById(updated.id) : null);
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
      throw new InvalidOrderStateTransitionError('Order payment has already been reversed.');
    }

    throw error;
  }
}

export async function rejectOrder(
  repository: OrderRepository,
  input: { orderId: string; reason?: string; actorUserId?: string; actorRole?: 'owner' | 'barista' },
) {
  return repository.runInTransaction(async (tx) => {
    const order = ensureOrder(await tx.getOrderById(input.orderId));
    assertCurrentState(order.status, ['pending_acceptance'], 'rejected');

    await reverseOrderPayment(
      tx,
      order,
      normalizeReason(input.reason, 'Rejected by café staff.'),
      input.actorUserId,
      input.actorRole ?? 'system',
    );

    await tx.updateOrderStatus({
      orderId: order.id,
      status: 'rejected',
      actedAt: new Date().toISOString(),
      rejectionReason: normalizeReason(input.reason, 'Rejected by café staff.'),
    });

    return ensureOrder(await tx.getOrderById(order.id));
  });
}

export async function cancelOrderByCustomer(
  repository: OrderRepository,
  input: { orderId: string; reason?: string },
) {
  return repository.runInTransaction(async (tx) => {
    const order = ensureOrder(await tx.getOrderById(input.orderId));
    assertCurrentState(order.status, ['pending_acceptance'], 'cancelled_by_customer');

    const placedAtMs = new Date(order.placedAt).getTime();
    if (Date.now() - placedAtMs > CUSTOMER_CANCELLATION_WINDOW_MS) {
      throw new CancellationWindowExpiredError('Customer cancellation window has expired.');
    }

    await reverseOrderPayment(
      tx,
      order,
      normalizeReason(input.reason, 'Cancelled by customer within allowed window.'),
      order.customerIdentifier,
      'system',
    );

    await tx.updateOrderStatus({
      orderId: order.id,
      status: 'cancelled_by_customer',
      actedAt: new Date().toISOString(),
      cancellationReason: normalizeReason(input.reason, 'Cancelled by customer within allowed window.'),
    });

    return ensureOrder(await tx.getOrderById(order.id));
  });
}

export async function markOrderReadyForPickup(repository: OrderRepository, input: { orderId: string }) {
  const order = ensureOrder(await repository.getOrderById(input.orderId));
  assertCurrentState(order.status, ['accepted'], 'ready_for_pickup');

  await repository.updateOrderStatus({
    orderId: order.id,
    status: 'ready_for_pickup',
    actedAt: new Date().toISOString(),
  });

  return ensureOrder(await repository.getOrderById(order.id));
}

export async function completeOrder(repository: OrderRepository, input: { orderId: string }) {
  const order = ensureOrder(await repository.getOrderById(input.orderId));
  assertCurrentState(order.status, ['ready_for_pickup'], 'completed');

  await repository.updateOrderStatus({
    orderId: order.id,
    status: 'completed',
    actedAt: new Date().toISOString(),
  });

  return ensureOrder(await repository.getOrderById(order.id));
}

export async function markOrderNoShow(repository: OrderRepository, input: { orderId: string }) {
  return repository.runInTransaction(async (tx) => {
    const order = ensureOrder(await tx.getOrderById(input.orderId));
    assertCurrentState(order.status, ['accepted', 'ready_for_pickup'], 'no_show');

    await tx.updateOrderStatus({
      orderId: order.id,
      status: 'no_show',
      actedAt: new Date().toISOString(),
    });

    const flags = await tx.incrementCustomerNoShowCount(order.customerIdentifier, new Date().toISOString());

    return {
      order: ensureOrder(await tx.getOrderById(order.id)),
      customerFlags: flags,
    };
  });
}
