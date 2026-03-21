'use client';

import { FormEvent, useEffect, useState } from 'react';

type StoreCode = 'store_1';

type Availability = {
  storeCode: StoreCode;
  storeName: string;
  isOrderAheadEnabled: boolean;
  disabledReasonCode: string | null;
  disabledComment: string | null;
  updatedAt: string;
};

type CustomerMenu = {
  storeCode: StoreCode;
  storeName: string;
  items: Array<{
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
  entryType: string;
  amountSigned: number;
  status: string;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
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

export default function ClientHomePage() {
  const [storeCode, setStoreCode] = useState<StoreCode>('store_1');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [menu, setMenu] = useState<CustomerMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerKey, setCustomerKey] = useState('demo-wallet-customer');
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState('8000');
  const [transferReference, setTransferReference] = useState('TRX-DEMO-0002');

  useEffect(() => {
    let isMounted = true;

    async function loadStoreData() {
      setError(null);

      const [availabilityResponse, menuResponse] = await Promise.all([
        fetch(`/api/stores/${storeCode}/order-ahead`, { cache: 'no-store' }),
        fetch(`/api/stores/${storeCode}/menu`, { cache: 'no-store' }),
      ]);

      const [availabilityPayload, menuPayload] = await Promise.all([
        availabilityResponse.json(),
        menuResponse.json(),
      ]);

      if (!isMounted) {
        return;
      }

      if (!availabilityResponse.ok) {
        setAvailability(null);
        setMenu(null);
        setError(availabilityPayload.error ?? 'Could not load availability.');
        return;
      }

      if (!menuResponse.ok) {
        setAvailability(availabilityPayload.availability as Availability);
        setMenu(null);
        setError(menuPayload.error ?? 'Could not load menu.');
        return;
      }

      setAvailability(availabilityPayload.availability as Availability);
      setMenu(menuPayload.menu as CustomerMenu);
    }

    void loadStoreData();

    return () => {
      isMounted = false;
    };
  }, [storeCode]);

  async function loadWalletData(nextCustomerKey = customerKey) {
    const normalizedCustomerKey = nextCustomerKey.trim();
    if (!normalizedCustomerKey) {
      setWalletError('Debes ingresar una customer key.');
      return;
    }

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

    if (!summaryResponse.ok) {
      setWalletSummary(null);
      setWalletTransactions([]);
      setWalletError(summaryPayload.error ?? 'No se pudo cargar la wallet.');
      return;
    }

    if (!transactionsResponse.ok) {
      setWalletSummary(summaryPayload as WalletSummary);
      setWalletTransactions([]);
      setWalletError(transactionsPayload.error ?? 'No se pudieron cargar los movimientos.');
      return;
    }

    setWalletSummary(summaryPayload as WalletSummary);
    setWalletTransactions((transactionsPayload.transactions as WalletTransaction[]) ?? []);
    setWalletError(null);
  }

  useEffect(() => {
    void loadWalletData('demo-wallet-customer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLookupWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadWalletData();
  }

  async function onTransferRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `/api/wallet/${encodeURIComponent(customerKey.trim())}/topup-transfer-request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Number(transferAmount),
          submittedReference: transferReference,
          note: 'Solicitud de recarga por transferencia',
        }),
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      setWalletError(payload.error ?? 'No se pudo crear la solicitud de transferencia.');
      return;
    }

    setWalletError(null);
    setTransferAmount('8000');
    await loadWalletData();
  }

  return (
    <main style={{ padding: 24, display: 'grid', gap: 24 }}>
      <header>
        <h1>Cliente</h1>
        <p>Vista mínima de order-ahead y wallet prepaga.</p>
      </header>

      <section style={{ border: '1px solid #ddd', padding: 16 }}>
        <label htmlFor="store-select">Sucursal</label>{' '}
        <select
          id="store-select"
          value={storeCode}
          onChange={(event) => setStoreCode(event.target.value as StoreCode)}
        >
          <option value="store_1">Store 1</option>
        </select>
        <p>Tienda seleccionada: {availability?.storeName ?? storeCode}</p>
        {error ? <p>Estado: no disponible ({error})</p> : null}
        {availability ? (
          <section>
            <h2>{availability.storeName}</h2>
            <p>
              Order-ahead:{' '}
              <strong>{availability.isOrderAheadEnabled ? 'Disponible' : 'No disponible'}</strong>
            </p>
            {!availability.isOrderAheadEnabled ? (
              <p>
                Motivo: {availability.disabledReasonCode}
                {availability.disabledComment ? ` (${availability.disabledComment})` : ''}
              </p>
            ) : null}
          </section>
        ) : null}
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16 }}>
        <h2>Menú disponible</h2>
        {!menu ? null : menu.items.length === 0 ? (
          <p>Esta sucursal no tiene productos disponibles por ahora.</p>
        ) : (
          <ul>
            {menu.items.map((item) => (
              <li key={item.storeMenuItemId}>
                <strong>{item.name}</strong> — {formatClp(item.priceAmount)}
                {item.description ? <div>{item.description}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16 }}>
        <h2>Mi wallet</h2>
        <p>
          Demo sugerida: <code>demo-wallet-customer</code>
        </p>
        <form onSubmit={onLookupWallet} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            aria-label="Customer key"
            value={customerKey}
            onChange={(event) => setCustomerKey(event.target.value)}
            placeholder="customer key"
          />
          <button type="submit">Ver wallet</button>
        </form>
        {walletError ? <p>{walletError}</p> : null}
        {walletSummary ? (
          <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
            <div>
              <p>
                Customer key: <strong>{walletSummary.wallet.customerIdentifier}</strong>
              </p>
              <p>
                Balance actual: <strong>{formatClp(walletSummary.currentBalance)}</strong>
              </p>
              <p>Moneda: {walletSummary.wallet.currencyCode}</p>
            </div>

            <form onSubmit={onTransferRequest} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
              <h3>Solicitar top-up por transferencia</h3>
              <input
                type="number"
                min={1}
                value={transferAmount}
                onChange={(event) => setTransferAmount(event.target.value)}
              />
              <input
                value={transferReference}
                onChange={(event) => setTransferReference(event.target.value)}
                placeholder="Referencia enviada"
              />
              <button type="submit">Enviar solicitud manual</button>
            </form>

            <div>
              <h3>Historial de transacciones</h3>
              {walletTransactions.length === 0 ? (
                <p>No hay movimientos todavía.</p>
              ) : (
                <ul style={{ display: 'grid', gap: 12, paddingLeft: 20 }}>
                  {walletTransactions.map((transaction) => (
                    <li key={transaction.id}>
                      <strong>{transaction.entryType}</strong> — {formatClp(transaction.amountSigned)} —{' '}
                      {transaction.status}
                      <div>{formatDateTime(transaction.createdAt)}</div>
                      {transaction.referenceType ? (
                        <div>
                          Ref: {transaction.referenceType} / {transaction.referenceId ?? '—'}
                        </div>
                      ) : null}
                      {transaction.note ? <div>{transaction.note}</div> : null}
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
