import {
  AvailabilitySnapshot,
  OrderAheadHistoryEvent,
  StoreAvailabilityRepository,
  UpdateOrderAheadInput,
} from '@/server/modules/stores/types';

export class OrderAheadValidationError extends Error {}
export class OrderAheadPermissionError extends Error {}
export class StoreNotFoundError extends Error {}

const STAFF_ROLES = new Set(['owner', 'barista']);

export async function getCustomerOrderAheadAvailability(
  repository: StoreAvailabilityRepository,
  storeCode: UpdateOrderAheadInput['storeCode'],
): Promise<AvailabilitySnapshot> {
  const snapshot = await repository.getAvailability(storeCode);

  if (!snapshot) {
    throw new StoreNotFoundError(`Store '${storeCode}' was not found.`);
  }

  return snapshot;
}

export async function getAdminOrderAheadOverview(
  repository: StoreAvailabilityRepository,
  storeCode: UpdateOrderAheadInput['storeCode'],
): Promise<{ availability: AvailabilitySnapshot; recentHistory: OrderAheadHistoryEvent[] }> {
  const availability = await getCustomerOrderAheadAvailability(repository, storeCode);
  const recentHistory = await repository.getRecentHistory(storeCode, 10);

  return { availability, recentHistory };
}

export async function updateOrderAheadAvailability(
  repository: StoreAvailabilityRepository,
  input: UpdateOrderAheadInput,
): Promise<AvailabilitySnapshot> {
  if (!STAFF_ROLES.has(input.actorRole)) {
    throw new OrderAheadPermissionError('Only owner or barista can change order-ahead state.');
  }

  const current = await repository.getAvailability(input.storeCode);

  if (!current) {
    throw new StoreNotFoundError(`Store '${input.storeCode}' was not found.`);
  }

  if (!input.newIsEnabled && !input.reasonCode) {
    throw new OrderAheadValidationError('Disabling order-ahead requires a reason code.');
  }

  const nextSnapshot: AvailabilitySnapshot = {
    ...current,
    isOrderAheadEnabled: input.newIsEnabled,
    disabledReasonCode: input.newIsEnabled ? null : input.reasonCode ?? null,
    disabledComment: input.newIsEnabled ? null : input.comment?.trim() || null,
    updatedAt: new Date().toISOString(),
  };

  await repository.setAvailabilityChange({
    snapshot: nextSnapshot,
    event: {
      newIsEnabled: input.newIsEnabled,
      reasonCode: input.newIsEnabled ? null : input.reasonCode ?? null,
      comment: input.newIsEnabled ? null : input.comment?.trim() || null,
      changedByUserId: input.actorUserId,
      changedByRole: input.actorRole,
      changedAt: nextSnapshot.updatedAt,
    },
  });

  return nextSnapshot;
}
