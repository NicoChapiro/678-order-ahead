import { and, asc, eq, notInArray } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { menuItems, storeMenuItems, stores } from '@/server/db/schema';
import { MenuConflictError, MenuNotFoundError } from '@/server/modules/menu/service';
import {
  AdminStoreMenu,
  BaseMenuItem,
  CustomerStoreMenu,
  CurrencyCode,
  MenuRepository,
  StoreMenuItem,
} from '@/server/modules/menu/types';

function mapBaseMenuItem(row: typeof menuItems.$inferSelect): BaseMenuItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapStoreMenuItem(row: {
  storeMenuItemId: string;
  menuItemId: string;
  code: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currencyCode: string;
  isVisible: boolean;
  isInStock: boolean;
  sortOrder: number | null;
  baseIsActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): StoreMenuItem {
  return {
    storeMenuItemId: row.storeMenuItemId,
    menuItemId: row.menuItemId,
    code: row.code,
    name: row.name,
    description: row.description,
    priceAmount: row.priceAmount,
    currencyCode: row.currencyCode as CurrencyCode,
    isVisible: row.isVisible,
    isInStock: row.isInStock,
    sortOrder: row.sortOrder,
    baseIsActive: row.baseIsActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getStoreRow(storeCode: string) {
  const rows = await getDb()
    .select({ id: stores.id, code: stores.code, name: stores.name })
    .from(stores)
    .where(eq(stores.code, storeCode as typeof stores.$inferSelect.code))
    .limit(1);

  return rows[0] ?? null;
}

async function getConfiguredItems(storeId: string) {
  return getDb()
    .select({
      storeMenuItemId: storeMenuItems.id,
      menuItemId: menuItems.id,
      code: menuItems.code,
      name: menuItems.name,
      description: menuItems.description,
      priceAmount: storeMenuItems.priceAmount,
      currencyCode: storeMenuItems.currencyCode,
      isVisible: storeMenuItems.isVisible,
      isInStock: storeMenuItems.isInStock,
      sortOrder: storeMenuItems.sortOrder,
      baseIsActive: menuItems.isActive,
      createdAt: storeMenuItems.createdAt,
      updatedAt: storeMenuItems.updatedAt,
    })
    .from(storeMenuItems)
    .innerJoin(menuItems, eq(menuItems.id, storeMenuItems.menuItemId))
    .where(eq(storeMenuItems.storeId, storeId))
    .orderBy(asc(storeMenuItems.sortOrder), asc(menuItems.name));
}

export const menuRepository: MenuRepository = {
  async listCustomerMenu(storeCode) {
    const store = await getStoreRow(storeCode);
    if (!store) {
      return null;
    }

    const rows = await getConfiguredItems(store.id);

    return {
      storeCode: store.code,
      storeName: store.name,
      items: rows.map(mapStoreMenuItem),
    } satisfies CustomerStoreMenu;
  },

  async listAdminMenu(storeCode) {
    const store = await getStoreRow(storeCode);
    if (!store) {
      return null;
    }

    const configuredRows = await getConfiguredItems(store.id);
    const configuredIds = configuredRows.map((row) => row.menuItemId);

    const availableRows = configuredIds.length
      ? await getDb()
          .select()
          .from(menuItems)
          .where(notInArray(menuItems.id, configuredIds))
          .orderBy(asc(menuItems.name))
      : await getDb().select().from(menuItems).orderBy(asc(menuItems.name));

    return {
      storeCode: store.code,
      storeName: store.name,
      configuredItems: configuredRows.map(mapStoreMenuItem),
      availableBaseItems: availableRows.map(mapBaseMenuItem),
    } satisfies AdminStoreMenu;
  },

  async createBaseMenuItem(input) {
    try {
      const rows = await getDb()
        .insert(menuItems)
        .values({
          code: input.code,
          name: input.name,
          description: input.description ?? null,
        })
        .returning();

      return mapBaseMenuItem(rows[0]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('menu_items_code_unique_idx')) {
        throw new MenuConflictError(`Menu item code '${input.code}' already exists.`);
      }

      throw error;
    }
  },

  async attachMenuItemToStore(input) {
    const store = await getStoreRow(input.storeCode);
    if (!store) {
      throw new MenuNotFoundError(`Store '${input.storeCode}' was not found.`);
    }

    try {
      await getDb()
        .insert(storeMenuItems)
        .values({
          storeId: store.id,
          menuItemId: input.menuItemId,
          priceAmount: input.priceAmount,
          currencyCode: input.currencyCode,
          isVisible: input.isVisible ?? true,
          isInStock: input.isInStock ?? true,
          sortOrder: input.sortOrder ?? null,
        });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('store_menu_items_store_menu_item_unique_idx')
      ) {
        throw new MenuConflictError('Menu item is already attached to this store.');
      }

      throw error;
    }

    const rows = await getConfiguredItems(store.id);
    const attached = rows.find((row) => row.menuItemId === input.menuItemId);

    if (!attached) {
      throw new Error('Attached menu item could not be reloaded.');
    }

    return mapStoreMenuItem(attached);
  },

  async updateStoreMenuItem(input) {
    const store = await getStoreRow(input.storeCode);
    if (!store) {
      return null;
    }

    const rows = await getDb()
      .update(storeMenuItems)
      .set({
        priceAmount: input.priceAmount,
        currencyCode: input.currencyCode,
        isVisible: input.isVisible,
        isInStock: input.isInStock,
        sortOrder: input.sortOrder ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(storeMenuItems.storeId, store.id), eq(storeMenuItems.menuItemId, input.menuItemId)),
      )
      .returning({ id: storeMenuItems.id });

    if (!rows[0]) {
      return null;
    }

    const configuredRows = await getConfiguredItems(store.id);
    const item = configuredRows.find((row) => row.menuItemId === input.menuItemId);

    return item ? mapStoreMenuItem(item) : null;
  },
};
