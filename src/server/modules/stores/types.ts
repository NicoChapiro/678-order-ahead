export type StoreCode = 'store_1' | 'store_2' | 'store_3';
export type StaffRole = 'owner' | 'barista';

export type OrderAheadReasonCode =
  | 'manual_pause'
  | 'equipment_issue'
  | 'staffing_issue'
  | 'inventory_issue'
  | 'system_issue'
  | 'other';

export type AvailabilitySnapshot = {
  storeCode: StoreCode;
  storeName: string;
  isOrderAheadEnabled: boolean;
  disabledReasonCode: OrderAheadReasonCode | null;
  disabledComment: string | null;
  updatedAt: string;
};

export type OrderAheadHistoryEvent = {
  id: string;
  newIsEnabled: boolean;
  reasonCode: OrderAheadReasonCode | null;
  comment: string | null;
  changedByUserId: string;
  changedByRole: string;
  changedAt: string;
};

export type UpdateOrderAheadInput = {
  storeCode: StoreCode;
  newIsEnabled: boolean;
  reasonCode?: OrderAheadReasonCode;
  comment?: string;
  actorUserId: string;
  actorRole: StaffRole;
};

export type StoreAvailabilityRepository = {
  getAvailability(storeCode: StoreCode): Promise<AvailabilitySnapshot | null>;
  getRecentHistory(storeCode: StoreCode, limit: number): Promise<OrderAheadHistoryEvent[]>;
  setAvailabilityChange(input: {
    snapshot: AvailabilitySnapshot;
    event: Omit<OrderAheadHistoryEvent, 'id'>;
  }): Promise<void>;
};
