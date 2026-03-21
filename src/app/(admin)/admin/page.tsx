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

type WalletSummary = {
  wallet: {
    id: string;
    customerIdentifier: string;
    currencyCode: 'CLP';
    createdAt: string;
    updatedAt: string;
  };
  currentBalance: number;
};

type WalletTransaction = {
  id: string;
  walletId: string;
  entryType: string;
  amountSigned: number;
  currencyCode: 'CLP';
  status: string;
  referenceType: string | null;
  referenceId: string | null;
  externalReference: string | null;
  note: string | null;
  createdByUserId: string | null;
  createdByRole: string | null;
  createdAt: string;
};

function formatClp(amount: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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

  const [walletCustomerKey, setWalletCustomerKey] = useState('demo-wallet-customer');
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [cashTopupAmount, setCashTopupAmount] = useState('5000');
  const [cashTopupNote, setCashTopupNote] = useState('Carga en caja');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'credit' | 'debit'>('credit');
  const [adjustmentAmount, setAdjustmentAmount] = useState('1000');
  const [adjustmentNote, setAdjustmentNote] = useState('Ajuste operativo');

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

  async function loadWalletData(customerKey = walletCustomerKey) {
    const normalizedCustomerKey = customerKey.trim();
    if (!normalizedCustomerKey) {
      setWalletError('Debes ingresar una customer key.');
      return;
    }

    setWalletLoading(true);
    const [summaryResponse, transactionsResponse] = await Promise.all([
      fetch(`/api/wallet/${encodeURIComponent(normalizedCustomerKey)}`, { cache: 'no-store' }),
      fetch(`/api/wallet/${encodeURIComponent(normalizedCustomerKey)}/transactions`, {
        cache: 'no-store',
      }),
    ]);
    const [summaryPayload, transactionsPayload] = await Promise.all([
      summaryResponse.json(),
      transactionsResponse.json(),
    ]);

    if (summaryResponse.status === 401 || transactionsResponse.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!summaryResponse.ok) {
      setWalletSummary(null);
      setWalletTransactions([]);
      setWalletError(summaryPayload.error ?? 'No se pudo cargar la wallet.');
      setWalletLoading(false);
      return;
    }

    if (!transactionsResponse.ok) {
      setWalletSummary(summaryPayload as WalletSummary);
      setWalletTransactions([]);
      setWalletError(transactionsPayload.error ?? 'No se pudieron cargar los movimientos.');
      setWalletLoading(false);
      return;
    }

    setWalletSummary(summaryPayload as WalletSummary);
    setWalletTransactions((transactionsPayload.transactions as WalletTransaction[]) ?? []);
    setWalletError(null);
    setWalletLoading(false);
  }

  useEffect(() => {
    void Promise.all([loadOverview(), loadMenuOverview()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCode]);

  useEffect(() => {
    void loadWalletData('demo-wallet-customer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setMenuError(payload.error ?? 'Could not create item.');
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
      setMenuError(payload.error ?? 'Could not attach item.');
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
      setMenuError(payload.error ?? 'Could not update store item.');
      return;
    }

    await loadMenuOverview();
  }

  async function onLookupWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadWalletData();
  }

  async function onCashTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `/api/admin/wallets/${encodeURIComponent(walletCustomerKey.trim())}/cash-topup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number(cashTopupAmount),
          note: cashTopupNote || undefined,
        }),
      },
    );
    const payload = await response.json();

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setWalletError(payload.error ?? 'No se pudo registrar la carga en caja.');
      return;
    }

    setWalletError(null);
    setCashTopupAmount('5000');
    await loadWalletData();
  }

  async function onAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `/api/admin/wallets/${encodeURIComponent(walletCustomerKey.trim())}/adjustment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          direction: adjustmentDirection,
          amount: Number(adjustmentAmount),
          note: adjustmentNote,
        }),
      },
    );
    const payload = await response.json();

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setWalletError(payload.error ?? 'No se pudo registrar el ajuste.');
      return;
    }

    setWalletError(null);
    await loadWalletData();
  }

  return (
    <main style={{ padding: 24, display: 'grid', gap: 24 }}>
      <header>
        <h1>Admin</h1>
        <p>Operación de order-ahead, menú y wallet prepaga.</p>
        <p>Las cargas por caja aceptan owner/barista. Los ajustes admin quedan validados owner-only en backend.</p>
      </header>

      <section style={{ border: '1px solid #ddd', padding: 16 }}>
        <h2>Order-ahead</h2>
        <label htmlFor="store-select">Sucursal</label>{' '}
        <select
          id="store-select"
          value={storeCode}
          onChange={(event) => setStoreCode(event.target.value as StoreCode)}
        >
          <option value="store_1">Store 1</option>
          <option value="store_2">Store 2</option>
          <option value="store_3">Store 3</option>
        </select>
        {error ? <p>{error}</p> : null}
        {overview ? (
          <>
            <p>
              Estado actual: <strong>{overview.availability.isOrderAheadEnabled ? 'Activo' : 'Pausado'}</strong>
            </p>
            <form onSubmit={onSubmitOrderAhead} style={{ display: 'grid', gap: 8, maxWidth: 460 }}>
              <label>
                <input
                  type="checkbox"
                  checked={newIsEnabled}
                  onChange={(event) => setNewIsEnabled(event.target.checked)}
                />{' '}
                Habilitar order-ahead
              </label>
              {!newIsEnabled ? (
                <>
                  <label>
                    Motivo
                    <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
                      <option value="manual_pause">Manual pause</option>
                      <option value="equipment_issue">Equipment issue</option>
                      <option value="staffing_issue">Staffing issue</option>
                      <option value="inventory_issue">Inventory issue</option>
                      <option value="system_issue">System issue</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    Comentario
                    <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
                  </label>
                </>
              ) : null}
              <button type="submit">Guardar estado</button>
            </form>
            <h3>Historial reciente</h3>
            <ul>
              {overview.recentHistory.map((event) => (
                <li key={event.id}>
                  {formatDateTime(event.changedAt)} — {event.newIsEnabled ? 'Activo' : 'Pausado'} por{' '}
                  {event.changedByRole}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16 }}>
        <h2>Menú</h2>
        {menuError ? <p>{menuError}</p> : null}
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <form onSubmit={onCreateBaseItem} style={{ display: 'grid', gap: 8 }}>
            <h3>Crear producto base</h3>
            <input
              placeholder="code"
              value={createCode}
              onChange={(event) => setCreateCode(event.target.value)}
            />
            <input
              placeholder="name"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
            />
            <textarea
              placeholder="description"
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
            />
            <button type="submit">Crear producto</button>
          </form>

          <form onSubmit={onAttachItem} style={{ display: 'grid', gap: 8 }}>
            <h3>Adjuntar a sucursal</h3>
            <select value={attachMenuItemId} onChange={(event) => setAttachMenuItemId(event.target.value)}>
              {menuOverview?.availableBaseItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={attachPriceAmount}
              onChange={(event) => setAttachPriceAmount(event.target.value)}
            />
            <button type="submit">Adjuntar producto</button>
          </form>
        </div>

        <h3>Configuración actual</h3>
        <ul style={{ display: 'grid', gap: 12, paddingLeft: 20 }}>
          {menuOverview?.configuredItems.map((item) => (
            <li key={item.storeMenuItemId}>
              <strong>{item.name}</strong> — {formatClp(item.priceAmount)}{' '}
              <button
                type="button"
                onClick={() =>
                  onUpdateStoreItem(item.menuItemId, {
                    priceAmount: item.priceAmount,
                    isVisible: !item.isVisible,
                    isInStock: item.isInStock,
                    sortOrder: item.sortOrder,
                  })
                }
              >
                {item.isVisible ? 'Ocultar' : 'Mostrar'}
              </button>{' '}
              <button
                type="button"
                onClick={() =>
                  onUpdateStoreItem(item.menuItemId, {
                    priceAmount: item.priceAmount,
                    isVisible: item.isVisible,
                    isInStock: !item.isInStock,
                    sortOrder: item.sortOrder,
                  })
                }
              >
                {item.isInStock ? 'Marcar sin stock' : 'Marcar con stock'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16 }}>
        <h2>Wallet prepaga</h2>
        <p>
          Customer key demo sugerida: <code>demo-wallet-customer</code>
        </p>
        <form onSubmit={onLookupWallet} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            aria-label="Customer key"
            value={walletCustomerKey}
            onChange={(event) => setWalletCustomerKey(event.target.value)}
            placeholder="customer key"
          />
          <button type="submit">Buscar wallet</button>
        </form>
        {walletError ? <p>{walletError}</p> : null}
        {walletSummary ? (
          <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
            <div>
              <p>
                Wallet: <strong>{walletSummary.wallet.customerIdentifier}</strong>
              </p>
              <p>
                Balance actual: <strong>{formatClp(walletSummary.currentBalance)}</strong>
              </p>
              <p>Moneda: {walletSummary.wallet.currencyCode}</p>
            </div>

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <form onSubmit={onCashTopup} style={{ display: 'grid', gap: 8 }}>
                <h3>Top-up por caja</h3>
                <input
                  type="number"
                  min={1}
                  value={cashTopupAmount}
                  onChange={(event) => setCashTopupAmount(event.target.value)}
                />
                <input
                  value={cashTopupNote}
                  onChange={(event) => setCashTopupNote(event.target.value)}
                  placeholder="Nota"
                />
                <button type="submit">Registrar carga inmediata</button>
              </form>

              <form onSubmit={onAdjustment} style={{ display: 'grid', gap: 8 }}>
                <h3>Ajuste admin</h3>
                <select
                  value={adjustmentDirection}
                  onChange={(event) => setAdjustmentDirection(event.target.value as 'credit' | 'debit')}
                >
                  <option value="credit">Crédito</option>
                  <option value="debit">Débito</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={adjustmentAmount}
                  onChange={(event) => setAdjustmentAmount(event.target.value)}
                />
                <textarea
                  value={adjustmentNote}
                  onChange={(event) => setAdjustmentNote(event.target.value)}
                  placeholder="Motivo obligatorio"
                />
                <button type="submit">Registrar ajuste</button>
              </form>
            </div>

            <div>
              <h3>Transacciones</h3>
              {walletLoading ? <p>Cargando…</p> : null}
              {walletTransactions.length === 0 ? (
                <p>Sin movimientos todavía.</p>
              ) : (
                <ul style={{ display: 'grid', gap: 12, paddingLeft: 20 }}>
                  {walletTransactions.map((transaction) => (
                    <li key={transaction.id}>
                      <strong>{transaction.entryType}</strong> — {formatClp(transaction.amountSigned)} —{' '}
                      {transaction.status} — {formatDateTime(transaction.createdAt)}
                      <div>
                        Actor: {transaction.createdByRole ?? 'n/a'} / Ref: {transaction.referenceType ?? 'n/a'}{' '}
                        {transaction.referenceId ?? '—'}
                      </div>
                      {transaction.note ? <div>Nota: {transaction.note}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
