import {
  attachMenuItemToStore,
  createBaseMenuItem,
  getAdminStoreMenu,
  getCustomerStoreMenu,
  MenuNotFoundError,
  MenuValidationError,
  updateStoreMenuItem,
} from '@/server/modules/menu/service';
import type {
  AdminStoreMenu,
  BaseMenuItem,
  CustomerStoreMenu,
  MenuRepository,
  StoreMenuItem,
} from '@/server/modules/menu/types';

function makeRepository(): MenuRepository {
  const baseItems: BaseMenuItem[] = [
    {
      id: 'base-espresso',
      code: 'espresso',
      name: 'Espresso',
      description: 'Single shot',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
    {
      id: 'base-latte',
      code: 'latte',
      name: 'Latte',
      description: 'Milk and espresso',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
  ];

  const configuredItems: StoreMenuItem[] = [
    {
      storeMenuItemId: 'store-item-1',
      menuItemId: 'base-espresso',
      code: 'espresso',
      name: 'Espresso',
      description: 'Single shot',
      priceAmount: 1800,
      currencyCode: 'CLP',
      isVisible: true,
      isInStock: true,
      sortOrder: 1,
      baseIsActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
    {
      storeMenuItemId: 'store-item-2',
      menuItemId: 'base-latte',
      code: 'latte',
      name: 'Latte',
      description: 'Milk and espresso',
      priceAmount: 2600,
      currencyCode: 'CLP',
      isVisible: false,
      isInStock: true,
      sortOrder: 2,
      baseIsActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
  ];

  return {
    async listCustomerMenu(storeCode) {
      if (storeCode !== 'store_1') {
        return null;
      }

      return {
        storeCode,
        storeName: 'Store 1',
        items: configuredItems.map((item) => ({ ...item })),
      } satisfies CustomerStoreMenu;
    },

    async listAdminMenu(storeCode) {
      if (storeCode !== 'store_1') {
        return null;
      }

      return {
        storeCode,
        storeName: 'Store 1',
        configuredItems: configuredItems.map((item) => ({ ...item })),
        availableBaseItems: baseItems.filter(
          (baseItem) =>
            !configuredItems.some((configuredItem) => configuredItem.menuItemId === baseItem.id),
        ),
      } satisfies AdminStoreMenu;
    },

    async createBaseMenuItem(input) {
      const createdItem: BaseMenuItem = {
        id: `base-${input.code}`,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        isActive: true,
        createdAt: new Date('2026-02-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-02-01T00:00:00.000Z').toISOString(),
      };

      baseItems.push(createdItem);
      return createdItem;
    },

    async attachMenuItemToStore(input) {
      const baseItem = baseItems.find((item) => item.id === input.menuItemId);
      if (!baseItem) {
        throw new Error('Base item not found.');
      }

      const attachedItem: StoreMenuItem = {
        storeMenuItemId: `store-${input.menuItemId}`,
        menuItemId: input.menuItemId,
        code: baseItem.code,
        name: baseItem.name,
        description: baseItem.description,
        priceAmount: input.priceAmount,
        currencyCode: input.currencyCode,
        isVisible: input.isVisible ?? true,
        isInStock: input.isInStock ?? true,
        sortOrder: input.sortOrder ?? null,
        baseIsActive: true,
        createdAt: new Date('2026-02-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-02-01T00:00:00.000Z').toISOString(),
      };

      configuredItems.push(attachedItem);
      return attachedItem;
    },

    async updateStoreMenuItem(input) {
      const existingItem = configuredItems.find((item) => item.menuItemId === input.menuItemId);
      if (!existingItem) {
        return null;
      }

      existingItem.priceAmount = input.priceAmount;
      existingItem.isVisible = input.isVisible;
      existingItem.isInStock = input.isInStock;
      existingItem.updatedAt = new Date('2026-03-01T00:00:00.000Z').toISOString();

      return { ...existingItem };
    },
  };
}

describe('menu service', () => {
  it('filters customer menu by store-specific visibility', async () => {
    const repository = makeRepository();

    const menu = await getCustomerStoreMenu(repository, 'store_1');

    expect(menu.items.map((item) => item.code)).toEqual(['espresso']);
  });

  it('filters customer menu by store-specific stock', async () => {
    const repository = makeRepository();
    await updateStoreMenuItem(repository, {
      storeCode: 'store_1',
      menuItemId: 'base-espresso',
      priceAmount: 1800,
      currencyCode: 'CLP',
      isVisible: true,
      isInStock: false,
    });

    const menu = await getCustomerStoreMenu(repository, 'store_1');

    expect(menu.items).toHaveLength(0);
  });

  it('creates a base item', async () => {
    const repository = makeRepository();

    const createdItem = await createBaseMenuItem(repository, {
      code: 'mocha',
      name: 'Mocha',
      description: 'Chocolate espresso drink',
    });

    const adminMenu = await getAdminStoreMenu(repository, 'store_1');

    expect(createdItem.code).toBe('mocha');
    expect(adminMenu.availableBaseItems.some((item) => item.code === 'mocha')).toBe(true);
  });

  it('attaches an item to a store', async () => {
    const repository = makeRepository();
    const createdItem = await createBaseMenuItem(repository, {
      code: 'flat-white',
      name: 'Flat White',
    });

    const attachedItem = await attachMenuItemToStore(repository, {
      storeCode: 'store_1',
      menuItemId: createdItem.id,
      priceAmount: 2900,
      currencyCode: 'CLP',
    });

    expect(attachedItem.menuItemId).toBe(createdItem.id);
    expect(attachedItem.priceAmount).toBe(2900);
  });

  it('updates store-specific price, visibility, and stock', async () => {
    const repository = makeRepository();

    const updatedItem = await updateStoreMenuItem(repository, {
      storeCode: 'store_1',
      menuItemId: 'base-espresso',
      priceAmount: 2100,
      currencyCode: 'CLP',
      isVisible: false,
      isInStock: false,
    });

    expect(updatedItem.priceAmount).toBe(2100);
    expect(updatedItem.isVisible).toBe(false);
    expect(updatedItem.isInStock).toBe(false);
  });

  it('rejects invalid price input', async () => {
    const repository = makeRepository();

    await expect(
      attachMenuItemToStore(repository, {
        storeCode: 'store_1',
        menuItemId: 'base-espresso',
        priceAmount: 0,
        currencyCode: 'CLP',
      }),
    ).rejects.toBeInstanceOf(MenuValidationError);
  });

  it('throws not found when store menu is missing', async () => {
    const repository = makeRepository();

    await expect(getCustomerStoreMenu(repository, 'store_2')).rejects.toBeInstanceOf(
      MenuNotFoundError,
    );
  });
});
