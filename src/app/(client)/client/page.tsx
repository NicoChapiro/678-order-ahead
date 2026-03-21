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

function formatClp(amount: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ClientHomePage() {
  const [storeCode, setStoreCode] = useState<StoreCode>('store_1');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [menu, setMenu] = useState<CustomerMenu | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    loadStoreData();

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
      <section>
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
    </main>
  );
}
