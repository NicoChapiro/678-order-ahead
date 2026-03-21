import type {
  CreateLedgerEntryInput,
  CreateTopupRequestInput,
  CreateWalletInput,
  CustomerWallet,
  ReviewTopupRequestInput,
  WalletLedgerEntry,
  WalletReferenceType,
  WalletTopupRequest,
} from '@/server/modules/wallet/types';
import type { StoreCode } from '@/server/modules/stores/types';

export const ORDER_STATUS_VALUES = [
  'pending_acceptance',
  'accepted',
  'rejected',
  'cancelled_by_customer',
  'ready_for_pickup',
  'completed',
  'no_show',
] as const;

export const ORDER_NOTIFICATION_TYPE_VALUES = [
  'order_accepted',
  'order_rejected',
  'order_ready',
  'order_completed',
  'order_cancelled',
  'order_no_show',
] as const;

export const ORDER_NOTIFICATION_CHANNEL_VALUES = ['internal', 'push', 'whatsapp', 'sms'] as const;

export const ORDER_NOTIFICATION_STATUS_VALUES = ['pending', 'skipped', 'sent', 'failed'] as const;

export const ORDER_EVENT_TYPE_VALUES = [
  'order_created',
  'order_accepted',
  'order_rejected',
  'order_ready',
  'order_completed',
  'order_cancelled',
  'order_no_show',
] as const;

export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];
export type OrderNotificationType = (typeof ORDER_NOTIFICATION_TYPE_VALUES)[number];
export type OrderNotificationChannel = (typeof ORDER_NOTIFICATION_CHANNEL_VALUES)[number];
export type OrderNotificationStatus = (typeof ORDER_NOTIFICATION_STATUS_VALUES)[number];
export type OrderEventType = (typeof ORDER_EVENT_TYPE_VALUES)[number];
export type OrderActorRole = 'owner' | 'barista' | 'system' | 'customer';

export type OrderItemSelectionInput = {
  menuItemId: string;
  quantity: number;
};

export type OrderItem = {
  id: string;
  orderId: string;
  menuItemId: string;
  storeMenuItemId: string;
  itemNameSnapshot: string;
  unitPriceAmount: number;
  quantity: number;
  lineTotalAmount: number;
  createdAt: string;
};

export type OrderEventRecord = {
  id: string;
  orderId: string;
  eventType: OrderEventType;
  actorUserId: string | null;
  actorRole: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
};

export type OrderNotificationRecord = {
  id: string;
  orderId: string;
  notificationType: OrderNotificationType;
  channel: OrderNotificationChannel;
  status: OrderNotificationStatus;
  recipientCustomerIdentifier: string | null;
  payloadJson: Record<string, unknown> | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type OrderRecord = {
  id: string;
  customerIdentifier: string;
  storeId: string;
  storeCode: StoreCode;
  storeName: string;
  status: OrderStatus;
  currencyCode: 'CLP';
  totalAmount: number;
  placedAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  noShowAt: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  lastEvent: OrderEventRecord | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderDetail = OrderRecord & {
  items: OrderItem[];
  events: OrderEventRecord[];
  notifications: OrderNotificationRecord[];
};

export type CustomerOrderFlags = {
  customerIdentifier: string;
  noShowCount: number;
  updatedAt: string;
};

export type StoreOrderContext = {
  storeId: string;
  storeCode: StoreCode;
  storeName: string;
  isOrderAheadEnabled: boolean;
};

export type StoreOrderMenuItem = {
  storeId: string;
  storeCode: StoreCode;
  storeMenuItemId: string;
  menuItemId: string;
  itemName: string;
  priceAmount: number;
  currencyCode: 'CLP';
  isVisible: boolean;
  isInStock: boolean;
  baseIsActive: boolean;
};

export type CreateOrderInput = {
  customerIdentifier: string;
  storeId: string;
  status: 'pending_acceptance';
  currencyCode: 'CLP';
  totalAmount: number;
  placedAt: string;
};

export type CreateOrderItemInput = {
  orderId: string;
  menuItemId: string;
  storeMenuItemId: string;
  itemNameSnapshot: string;
  unitPriceAmount: number;
  quantity: number;
  lineTotalAmount: number;
};

export type UpdateOrderStatusInput = {
  orderId: string;
  status: OrderStatus;
  actedAt: string;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
};

export type CreateOrderEventInput = {
  orderId: string;
  eventType: OrderEventType;
  actorUserId?: string | null;
  actorRole?: string | null;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
};

export type CreateOrderNotificationInput = {
  orderId: string;
  notificationType: OrderNotificationType;
  channel: OrderNotificationChannel;
  status: OrderNotificationStatus;
  recipientCustomerIdentifier?: string | null;
  payloadJson?: Record<string, unknown> | null;
  failureReason?: string | null;
  createdAt: string;
  processedAt?: string | null;
};

export type OrderActionResult = {
  order: OrderDetail;
  transitionApplied: boolean;
  event: OrderEventRecord | null;
  notification: OrderNotificationRecord | null;
};

export type OrderNoShowResult = OrderActionResult & {
  customerFlags: CustomerOrderFlags;
};

export type OrderRepository = {
  getStoreOrderContext(storeCode: StoreCode): Promise<StoreOrderContext | null>;
  listStoreOrderMenuItems(storeCode: StoreCode, menuItemIds: string[]): Promise<StoreOrderMenuItem[]>;
  createOrder(input: CreateOrderInput): Promise<OrderRecord>;
  createOrderItems(items: CreateOrderItemInput[]): Promise<OrderItem[]>;
  getOrderById(orderId: string): Promise<OrderDetail | null>;
  listCustomerOrders(customerIdentifier: string): Promise<OrderDetail[]>;
  listAdminOrders(storeCode: StoreCode, status?: OrderStatus): Promise<OrderDetail[]>;
  updateOrderStatus(input: UpdateOrderStatusInput): Promise<OrderRecord | null>;
  createOrderEvent(input: CreateOrderEventInput): Promise<OrderEventRecord>;
  createOrderNotification(input: CreateOrderNotificationInput): Promise<OrderNotificationRecord>;
  getCustomerOrderFlags(customerIdentifier: string): Promise<CustomerOrderFlags | null>;
  incrementCustomerNoShowCount(customerIdentifier: string, actedAt: string): Promise<CustomerOrderFlags>;
  findWalletByCustomerIdentifier(customerIdentifier: string): Promise<CustomerWallet | null>;
  createWallet(input: CreateWalletInput): Promise<CustomerWallet>;
  getPostedBalance(walletId: string): Promise<number>;
  listLedgerEntries(walletId: string): Promise<WalletLedgerEntry[]>;
  createLedgerEntry(input: CreateLedgerEntryInput): Promise<WalletLedgerEntry>;
  createTopupRequest(input: CreateTopupRequestInput): Promise<WalletTopupRequest>;
  getTopupRequestById(topupRequestId: string): Promise<WalletTopupRequest | null>;
  reviewTopupRequest(input: ReviewTopupRequestInput): Promise<WalletTopupRequest | null>;
  listReferenceEntries(
    walletId: string,
    referenceType: WalletReferenceType,
    referenceId: string,
  ): Promise<WalletLedgerEntry[]>;
  runInTransaction<T>(callback: (repository: OrderRepository) => Promise<T>): Promise<T>;
};
