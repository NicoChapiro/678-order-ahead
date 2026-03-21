import type { StoreCode } from '@/server/modules/stores/types';
import {
  AttachMenuItemToStoreInput,
  BaseMenuItem,
  CustomerStoreMenu,
  FIXED_CURRENCY_CODE,
  MenuRepository,
  UpdateStoreMenuItemInput,
} from '@/server/modules/menu/types';

export class MenuValidationError extends Error {}
export class MenuConflictError extends Error {}
export class MenuNotFoundError extends Error {}

function validatePrice(priceAmount: number) {
  if (!Number.isInteger(priceAmount) || priceAmount <= 0) {
    throw new MenuValidationError('Price amount must be a positive integer.');
  }
}

function validateCode(code: string) {
  const normalizedCode = code.trim().toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedCode)) {
    throw new MenuValidationError(
      'Code must use lowercase letters, numbers, and optional hyphen-separated words.',
    );
  }

  return normalizedCode;
}

export async function getCustomerStoreMenu(
  repository: MenuRepository,
  storeCode: StoreCode,
): Promise<CustomerStoreMenu> {
  const menu = await repository.listCustomerMenu(storeCode);

  if (!menu) {
    throw new MenuNotFoundError(`Store '${storeCode}' was not found.`);
  }

  return {
    ...menu,
    items: menu.items.filter((item) => item.baseIsActive && item.isVisible && item.isInStock),
  };
}

export async function getAdminStoreMenu(repository: MenuRepository, storeCode: StoreCode) {
  const menu = await repository.listAdminMenu(storeCode);

  if (!menu) {
    throw new MenuNotFoundError(`Store '${storeCode}' was not found.`);
  }

  return menu;
}

export async function createBaseMenuItem(
  repository: MenuRepository,
  input: { code: string; name: string; description?: string },
): Promise<BaseMenuItem> {
  const code = validateCode(input.code);
  const name = input.name.trim();
  const description = input.description?.trim();

  if (!name) {
    throw new MenuValidationError('Name is required.');
  }

  try {
    return await repository.createBaseMenuItem({
      code,
      name,
      description: description || undefined,
    });
  } catch (error) {
    if (error instanceof MenuConflictError) {
      throw error;
    }

    throw error;
  }
}

export async function attachMenuItemToStore(
  repository: MenuRepository,
  input: AttachMenuItemToStoreInput,
) {
  validatePrice(input.priceAmount);

  if (input.currencyCode !== FIXED_CURRENCY_CODE) {
    throw new MenuValidationError('Currency code must be CLP.');
  }

  return repository.attachMenuItemToStore(input);
}

export async function updateStoreMenuItem(
  repository: MenuRepository,
  input: UpdateStoreMenuItemInput,
) {
  validatePrice(input.priceAmount);

  if (input.currencyCode !== FIXED_CURRENCY_CODE) {
    throw new MenuValidationError('Currency code must be CLP.');
  }

  const updatedItem = await repository.updateStoreMenuItem(input);

  if (!updatedItem) {
    throw new MenuNotFoundError(
      `Menu item '${input.menuItemId}' was not found for store '${input.storeCode}'.`,
    );
  }

  return updatedItem;
}
