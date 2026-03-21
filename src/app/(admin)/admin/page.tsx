'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type StoreCode = 'store_1' | 'store_2' | 'store_3';

type AdminOverview = {
  availability: {
    storeCode: StoreCode;
    storeName: string;
    isOrderAheadEnabled: boolean;
    disabledReasonCode: string | null;
    disabledComment: string | null;
    updatedAt: string;
  };
  recentHistory: Array<{
    id: string;
    newIsEnabled: boolean;
    reasonCode: string | null;
    comment: string | null;
    changedByUserId: string;
    changedByRole: string;
    changedAt: string;
  }>;
};

type MenuOverview = {
  storeCode: StoreCode;
  storeName: string;
  configuredItems: Array<{
    storeMenuItemId: string;
    menuItemId: string;
    code: string;
    name: string;
    description: string | null;
    priceAmount: number;
    currencyCode: 'CLP';
    isVisible: boolean;
    isInStock: boolean;
    sortOrder: number | null;
    baseIsActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  availableBaseItems: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
};

function formatClp(amount: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AdminHomePage() {
  const router = useRouter();
  const [storeCode, setStoreCode] = useState<StoreCode>('store_1');
  const [newIsEnabled, setNewIsEnabled] = useState(true);
  const [reasonCode, setReasonCode] = useState('manual_pause');
  const [comment, setComment] = useState('');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [menuOverview, setMenuOverview] = useState<MenuOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [attachMenuItemId, setAttachMenuItemId] = useState('');
  const [attachPriceAmount, setAttachPriceAmount] = useState('2500');

  async function loadOverview() {
    const response = await fetch(`/api/admin/stores/${storeCode}/order-ahead`, {
      cache: 'no-store',
    });
    const payload = await response.json();

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setError(payload.error ?? 'Could not load admin overview.');
      return;
    }

    setError(null);
    setOverview(payload as AdminOverview);
    setNewIsEnabled(payload.availability.isOrderAheadEnabled as boolean);
    setReasonCode(payload.availability.disabledReasonCode ?? 'manual_pause');
    setComment(payload.availability.disabledComment ?? '');
  }

  async function loadMenuOverview() {
    const response = await fetch(`/api/admin/stores/${storeCode}/menu`, {
      cache: 'no-store',
    });
    const payload = await response.json();

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setMenuError(payload.error ?? 'Could not load store menu.');
      return;
    }

    setMenuError(null);
    setMenuOverview(payload.menu as MenuOverview);

    const nextAttachId = (payload.menu as MenuOverview).availableBaseItems[0]?.id ?? '';
    setAttachMenuItemId((current) => current || nextAttachId);
  }

  useEffect(() => {
    void Promise.all([loadOverview(), loadMenuOverview()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCode]);

  async function onSubmitOrderAhead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/admin/stores/${storeCode}/order-ahead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        newIsEnabled,
        reasonCode: newIsEnabled ? undefined : reasonCode,
        comment: newIsEnabled ? undefined : comment,
      }),
    });

    const payload = await response.json();
    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setError(payload.error?.formErrors?.[0] ?? payload.error ?? 'Could not update status.');
      return;
    }

    await loadOverview();
  }

  async function onCreateBaseItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/admin/menu-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: createCode,
        name: createName,
        description: createDescription || undefined,
      }),
    });

    const payload = await response.json();
    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setMenuError(
        payload.error?.fieldErrors?.priceAmount?.[0] ?? payload.error ?? 'Could not create item.',
      );
      return;
    }

    setCreateCode('');
    setCreateName('');
    setCreateDescription('');
    await loadMenuOverview();
  }

  async function onAttachItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const response = await fetch(`/api/admin/stores/${storeCode}/menu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        menuItemId: attachMenuItemId,
        priceAmount: Number(attachPriceAmount),
        currencyCode: 'CLP',
        isVisible: true,
        isInStock: true,
      }),
    });

    const payload = await response.json();
    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setMenuError(
        payload.error?.fieldErrors?.priceAmount?.[0] ?? payload.error ?? 'Could not attach item.',
      );
      return;
    }

    setAttachPriceAmount('2500');
    await loadMenuOverview();
  }

  async function onUpdateStoreItem(
    menuItemId: string,
    nextState: {
      priceAmount: number;
      isVisible: boolean;
      isInStock: boolean;
      sortOrder: number | null;
    },
  ) {
    const response = await fetch(`/api/admin/stores/${storeCode}/menu/${menuItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...nextState,
        currencyCode: 'CLP',
      }),
    });

    const payload = await response.json();
    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setMenuError(
        payload.error?.fieldErrors?.priceAmount?.[0] ??
          payload.error ??
          'Could not update store item.',
      );
      return;
    }

    await loadMenuOverview();
  }

  async function onLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <main>
      <h1>Admin</h1>
      <p>Order-ahead controls and store-specific menu management.</p>
      <button type="button" onClick={onLogout}>
        Logout
      </button>

      <section>
        <h2>Store context</h2>
        <label htmlFor="store-code">Store</label>{' '}
        <select
          id="store-code"
          value={storeCode}
          onChange={(event) => setStoreCode(event.target.value as StoreCode)}
        >
          <option value="store_1">Store 1</option>
          <option value="store_2">Store 2</option>
          <option value="store_3">Store 3</option>
        </select>
      </section>

      <form onSubmit={onSubmitOrderAhead}>
        <h2>Order-ahead</h2>
        <div>
          <label>
            <input
              type="radio"
              name="status"
              checked={newIsEnabled}
              onChange={() => setNewIsEnabled(true)}
            />
            Enabled
          </label>{' '}
          <label>
            <input
              type="radio"
              name="status"
              checked={!newIsEnabled}
              onChange={() => setNewIsEnabled(false)}
            />
            Disabled
          </label>
        </div>

        {!newIsEnabled ? (
          <>
            <label htmlFor="reason">Reason</label>{' '}
            <select
              id="reason"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            >
              <option value="manual_pause">manual_pause</option>
              <option value="equipment_issue">equipment_issue</option>
              <option value="staffing_issue">staffing_issue</option>
              <option value="inventory_issue">inventory_issue</option>
              <option value="system_issue">system_issue</option>
              <option value="other">other</option>
            </select>{' '}
            <label htmlFor="comment">Comment</label>{' '}
            <input
              id="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </>
        ) : null}

        <button type="submit">Save order-ahead</button>
      </form>

      {error ? <p>Error: {error}</p> : null}

      {overview ? (
        <section>
          <h2>Current status</h2>
          <p>
            {overview.availability.storeName}:{' '}
            {overview.availability.isOrderAheadEnabled ? 'Enabled' : 'Disabled'}
          </p>
          <h3>Recent history</h3>
          <ul>
            {overview.recentHistory.map((event) => (
              <li key={event.id}>
                {new Date(event.changedAt).toLocaleString()} —{' '}
                {event.newIsEnabled ? 'Enabled' : 'Disabled'} by {event.changedByRole} (
                {event.changedByUserId}){event.reasonCode ? ` / ${event.reasonCode}` : ''}
                {event.comment ? ` / ${event.comment}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2>Create base item</h2>
        <form onSubmit={onCreateBaseItem}>
          <label htmlFor="base-code">Code</label>{' '}
          <input
            id="base-code"
            value={createCode}
            onChange={(event) => setCreateCode(event.target.value)}
          />{' '}
          <label htmlFor="base-name">Name</label>{' '}
          <input
            id="base-name"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />{' '}
          <label htmlFor="base-description">Description</label>{' '}
          <input
            id="base-description"
            value={createDescription}
            onChange={(event) => setCreateDescription(event.target.value)}
          />{' '}
          <button type="submit">Create item</button>
        </form>
      </section>

      <section>
        <h2>Attach item to current store</h2>
        <form onSubmit={onAttachItem}>
          <label htmlFor="attach-menu-item">Base item</label>{' '}
          <select
            id="attach-menu-item"
            value={attachMenuItemId}
            onChange={(event) => setAttachMenuItemId(event.target.value)}
          >
            <option value="">Select item</option>
            {menuOverview?.availableBaseItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.code})
              </option>
            ))}
          </select>{' '}
          <label htmlFor="attach-price">Price CLP</label>{' '}
          <input
            id="attach-price"
            type="number"
            min="1"
            step="1"
            value={attachPriceAmount}
            onChange={(event) => setAttachPriceAmount(event.target.value)}
          />{' '}
          <button type="submit" disabled={!attachMenuItemId}>
            Attach to store
          </button>
        </form>
      </section>

      {menuError ? <p>Menu error: {menuError}</p> : null}

      <section>
        <h2>Configured items for {menuOverview?.storeName ?? storeCode}</h2>
        {!menuOverview ? null : menuOverview.configuredItems.length === 0 ? (
          <p>No menu items configured for this store yet.</p>
        ) : (
          <ul>
            {menuOverview.configuredItems.map((item) => (
              <li key={item.storeMenuItemId}>
                <StoreMenuItemEditor item={item} onSave={onUpdateStoreItem} />
                <div>
                  Current: {formatClp(item.priceAmount)} / visible: {item.isVisible ? 'yes' : 'no'}{' '}
                  / stock: {item.isInStock ? 'in stock' : 'out of stock'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StoreMenuItemEditor({
  item,
  onSave,
}: {
  item: MenuOverview['configuredItems'][number];
  onSave: (
    menuItemId: string,
    nextState: {
      priceAmount: number;
      isVisible: boolean;
      isInStock: boolean;
      sortOrder: number | null;
    },
  ) => Promise<void>;
}) {
  const [priceAmount, setPriceAmount] = useState(String(item.priceAmount));
  const [isVisible, setIsVisible] = useState(item.isVisible);
  const [isInStock, setIsInStock] = useState(item.isInStock);

  useEffect(() => {
    setPriceAmount(String(item.priceAmount));
    setIsVisible(item.isVisible);
    setIsInStock(item.isInStock);
  }, [item.isInStock, item.isVisible, item.priceAmount]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(item.menuItemId, {
          priceAmount: Number(priceAmount),
          isVisible,
          isInStock,
          sortOrder: item.sortOrder,
        });
      }}
    >
      <strong>{item.name}</strong> ({item.code})
      {item.description ? <div>{item.description}</div> : null}
      <label>
        Price CLP{' '}
        <input
          type="number"
          min="1"
          step="1"
          value={priceAmount}
          onChange={(event) => setPriceAmount(event.target.value)}
        />
      </label>{' '}
      <label>
        <input
          type="checkbox"
          checked={isVisible}
          onChange={(event) => setIsVisible(event.target.checked)}
        />
        Visible
      </label>{' '}
      <label>
        <input
          type="checkbox"
          checked={isInStock}
          onChange={(event) => setIsInStock(event.target.checked)}
        />
        In stock
      </label>{' '}
      <button type="submit">Save item</button>
    </form>
  );
}
