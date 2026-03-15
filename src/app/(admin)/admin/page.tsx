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

export default function AdminHomePage() {
  const router = useRouter();
  const [storeCode, setStoreCode] = useState<StoreCode>('store_1');
  const [newIsEnabled, setNewIsEnabled] = useState(true);
  const [reasonCode, setReasonCode] = useState('manual_pause');
  const [comment, setComment] = useState('');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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

  async function onLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <main>
      <h1>Admin</h1>
      <p>Order-ahead controls (owner/barista only).</p>
      <button type="button" onClick={onLogout}>
        Logout
      </button>

      <form onSubmit={onSubmit}>
        <label htmlFor="store-code">Store</label>{' '}
        <select
          id="store-code"
          value={storeCode}
          onChange={(event) => setStoreCode(event.target.value as StoreCode)}
        >
          <option value="store_1">Store 1</option>
          <option value="store_2">Store 2</option>
          <option value="store_3">Store 3</option>
        </select>{' '}

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
            <select id="reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
              <option value="manual_pause">manual_pause</option>
              <option value="equipment_issue">equipment_issue</option>
              <option value="staffing_issue">staffing_issue</option>
              <option value="inventory_issue">inventory_issue</option>
              <option value="system_issue">system_issue</option>
              <option value="other">other</option>
            </select>{' '}
            <label htmlFor="comment">Comment</label>{' '}
            <input id="comment" value={comment} onChange={(event) => setComment(event.target.value)} />
          </>
        ) : null}

        <button type="submit">Save</button>
      </form>

      {error ? <p>Error: {error}</p> : null}

      {overview ? (
        <section>
          <h2>Current status</h2>
          <p>
            {overview.availability.storeName}: {overview.availability.isOrderAheadEnabled ? 'Enabled' : 'Disabled'}
          </p>
          <h3>Recent history</h3>
          <ul>
            {overview.recentHistory.map((event) => (
              <li key={event.id}>
                {new Date(event.changedAt).toLocaleString()} — {event.newIsEnabled ? 'Enabled' : 'Disabled'} by{' '}
                {event.changedByRole} ({event.changedByUserId})
                {event.reasonCode ? ` / ${event.reasonCode}` : ''}
                {event.comment ? ` / ${event.comment}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
