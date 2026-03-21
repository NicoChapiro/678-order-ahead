import type { StoreCode } from '@/server/modules/stores/types';

export const FIXED_CURRENCY_CODE = 'CLP' as const;
export type CurrencyCode = typeof FIXED_CURRENCY_CODE;

export type BaseMenuItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoreMenuItem = {
  storeMenuItemId: string;
  menuItemId: string;
  code: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currencyCode: CurrencyCode;
  isVisible: boolean;
  isInStock: boolean;
  sortOrder: number | null;
  baseIsActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerStoreMenu = {
  storeCode: StoreCode;
  storeName: string;
  items: StoreMenuItem[];
};

export type AdminStoreMenu = {
  storeCode: StoreCode;
  storeName: string;
  configuredItems: StoreMenuItem[];
  availableBaseItems: BaseMenuItem[];
};

export type CreateBaseMenuItemInput = {
  code: string;
  name: string;
  description?: string;
};

export type AttachMenuItemToStoreInput = {
  storeCode: StoreCode;
  menuItemId: string;
  priceAmount: number;
  currencyCode: CurrencyCode;
  isVisible?: boolean;
  isInStock?: boolean;
  sortOrder?: number | null;
};

export type UpdateStoreMenuItemInput = {
  storeCode: StoreCode;
  menuItemId: string;
  priceAmount: number;
  currencyCode: CurrencyCode;
  isVisible: boolean;
  isInStock: boolean;
  sortOrder?: number | null;
};

export type MenuRepository = {
  listCustomerMenu(storeCode: StoreCode): Promise<CustomerStoreMenu | null>;
  listAdminMenu(storeCode: StoreCode): Promise<AdminStoreMenu | null>;
  createBaseMenuItem(input: CreateBaseMenuItemInput): Promise<BaseMenuItem>;
  attachMenuItemToStore(input: AttachMenuItemToStoreInput): Promise<StoreMenuItem>;
  updateStoreMenuItem(input: UpdateStoreMenuItemInput): Promise<StoreMenuItem | null>;
};
