import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import {
  storeOrderAheadEvents,
  storeOrderAheadSettings,
  stores,
} from '@/server/db/schema';
import {
  AvailabilitySnapshot,
  OrderAheadHistoryEvent,
  StoreAvailabilityRepository,
  StoreCode,
} from '@/server/modules/stores/types';

type AvailabilityRow = {
  code: StoreCode;
  name: string;
  isEnabled: boolean;
  disabledReasonCode: AvailabilitySnapshot['disabledReasonCode'];
  disabledComment: string | null;
  updatedAt: Date;
};

async function getAvailabilityRow(storeCode: StoreCode): Promise<AvailabilityRow | null> {
  const rows = await db
    .select({
      code: stores.code,
      name: stores.name,
      isEnabled: storeOrderAheadSettings.isEnabled,
      disabledReasonCode: storeOrderAheadSettings.disabledReasonCode,
      disabledComment: storeOrderAheadSettings.disabledComment,
      updatedAt: storeOrderAheadSettings.updatedAt,
    })
    .from(stores)
    .innerJoin(storeOrderAheadSettings, eq(storeOrderAheadSettings.storeId, stores.id))
    .where(and(eq(stores.code, storeCode), eq(stores.isActive, true)))
    .limit(1);

  return rows[0] ?? null;
}

export const storeAvailabilityRepository: StoreAvailabilityRepository = {
  async getAvailability(storeCode) {
    const row = await getAvailabilityRow(storeCode);

    if (!row) {
      return null;
    }

    return {
      storeCode: row.code,
      storeName: row.name,
      isOrderAheadEnabled: row.isEnabled,
      disabledReasonCode: row.disabledReasonCode,
      disabledComment: row.disabledComment,
      updatedAt: row.updatedAt.toISOString(),
    };
  },

  async getRecentHistory(storeCode, limit) {
    const row = await db.select({ id: stores.id }).from(stores).where(eq(stores.code, storeCode)).limit(1);
    if (!row[0]) {
      return [];
    }

    const historyRows = await db
      .select({
        id: storeOrderAheadEvents.id,
        newIsEnabled: storeOrderAheadEvents.newIsEnabled,
        reasonCode: storeOrderAheadEvents.reasonCode,
        comment: storeOrderAheadEvents.comment,
        changedByUserId: storeOrderAheadEvents.changedByUserId,
        changedByRole: storeOrderAheadEvents.changedByRole,
        changedAt: storeOrderAheadEvents.changedAt,
      })
      .from(storeOrderAheadEvents)
      .where(eq(storeOrderAheadEvents.storeId, row[0].id))
      .orderBy(desc(storeOrderAheadEvents.changedAt))
      .limit(limit);

    return historyRows.map(
      (event): OrderAheadHistoryEvent => ({
        ...event,
        changedAt: event.changedAt.toISOString(),
      }),
    );
  },

  async setAvailabilityChange({ snapshot, event }) {
    const storeRow = await db.select({ id: stores.id }).from(stores).where(eq(stores.code, snapshot.storeCode)).limit(1);

    if (!storeRow[0]) {
      return;
    }

    await db
      .update(storeOrderAheadSettings)
      .set({
        isEnabled: snapshot.isOrderAheadEnabled,
        disabledReasonCode: snapshot.disabledReasonCode,
        disabledComment: snapshot.disabledComment,
        updatedByUserId: event.changedByUserId,
        updatedByRole: event.changedByRole,
        updatedAt: new Date(snapshot.updatedAt),
      })
      .where(eq(storeOrderAheadSettings.storeId, storeRow[0].id));

    await db.insert(storeOrderAheadEvents).values({
      storeId: storeRow[0].id,
      newIsEnabled: event.newIsEnabled,
      reasonCode: event.reasonCode,
      comment: event.comment,
      changedByUserId: event.changedByUserId,
      changedByRole: event.changedByRole,
      changedAt: new Date(event.changedAt),
    });
  },
};
