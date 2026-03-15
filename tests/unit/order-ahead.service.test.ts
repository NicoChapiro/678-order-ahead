import {
  OrderAheadPermissionError,
  OrderAheadValidationError,
  getAdminOrderAheadOverview,
  updateOrderAheadAvailability,
} from '@/server/modules/stores/service';
import {
  AvailabilitySnapshot,
  OrderAheadHistoryEvent,
  StoreAvailabilityRepository,
} from '@/server/modules/stores/types';

function makeRepository(): StoreAvailabilityRepository {
  const snapshot: AvailabilitySnapshot = {
    storeCode: 'store_1',
    storeName: 'Store 1',
    isOrderAheadEnabled: true,
    disabledReasonCode: null,
    disabledComment: null,
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  };

  const history: OrderAheadHistoryEvent[] = [
    {
      id: 'evt-1',
      newIsEnabled: true,
      reasonCode: null,
      comment: 'Initial setup',
      changedByUserId: 'system',
      changedByRole: 'owner',
      changedAt: snapshot.updatedAt,
    },
  ];

  return {
    async getAvailability(storeCode) {
      return storeCode === 'store_1' ? { ...snapshot } : null;
    },
    async getRecentHistory(storeCode) {
      return storeCode === 'store_1' ? [...history] : [];
    },
    async setAvailabilityChange(input) {
      snapshot.isOrderAheadEnabled = input.snapshot.isOrderAheadEnabled;
      snapshot.disabledReasonCode = input.snapshot.disabledReasonCode;
      snapshot.disabledComment = input.snapshot.disabledComment;
      snapshot.updatedAt = input.snapshot.updatedAt;

      history.unshift({
        id: `evt-${history.length + 1}`,
        ...input.event,
      });
    },
  };
}

describe('order-ahead service', () => {
  it('allows owner to disable order-ahead with required reason and writes history event', async () => {
    const repository = makeRepository();

    const result = await updateOrderAheadAvailability(repository, {
      storeCode: 'store_1',
      newIsEnabled: false,
      reasonCode: 'equipment_issue',
      comment: 'Espresso machine maintenance',
      actorUserId: 'owner-1',
      actorRole: 'owner',
    });

    expect(result.isOrderAheadEnabled).toBe(false);
    expect(result.disabledReasonCode).toBe('equipment_issue');

    const overview = await getAdminOrderAheadOverview(repository, 'store_1');
    expect(overview.recentHistory[0]?.reasonCode).toBe('equipment_issue');
    expect(overview.recentHistory[0]?.changedByRole).toBe('owner');
  });

  it('rejects disabling without reason code', async () => {
    const repository = makeRepository();

    await expect(
      updateOrderAheadAvailability(repository, {
        storeCode: 'store_1',
        newIsEnabled: false,
        actorUserId: 'barista-1',
        actorRole: 'barista',
      }),
    ).rejects.toBeInstanceOf(OrderAheadValidationError);
  });

  it('rejects state changes from non-staff roles', async () => {
    const repository = makeRepository();

    await expect(
      updateOrderAheadAvailability(repository, {
        storeCode: 'store_1',
        newIsEnabled: true,
        actorUserId: 'customer-1',
        actorRole: 'customer',
      }),
    ).rejects.toBeInstanceOf(OrderAheadPermissionError);
  });
});
