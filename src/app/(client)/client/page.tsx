'use client';

import { useEffect, useState } from 'react';

type StoreCode = 'store_1';

type Availability = {
  storeCode: StoreCode;
  storeName: string;
  isOrderAheadEnabled: boolean;
  disabledReasonCode: string | null;
  disabledComment: string | null;
  updatedAt: string;
};

export default function ClientHomePage() {
  const [storeCode, setStoreCode] = useState<StoreCode>('store_1');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAvailability() {
      setError(null);
      const response = await fetch(`/api/stores/${storeCode}/order-ahead`, { cache: 'no-store' });
      const payload = await response.json();

      if (!isMounted) {
        return;
      }

      if (!response.ok) {
        setAvailability(null);
        setError(payload.error ?? 'Could not load availability.');
        return;
      }

      setAvailability(payload.availability as Availability);
    }

    loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [storeCode]);

  return (
    <main>
      <h1>Cliente</h1>
      <label htmlFor="store-select">Sucursal</label>{' '}
      <select
        id="store-select"
        value={storeCode}
        onChange={(event) => setStoreCode(event.target.value as StoreCode)}
      >
        <option value="store_1">Store 1</option>
      </select>

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
    </main>
  );
}
