'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AppShell,
  CardHeader,
  EmptyState,
  InlineFeedback,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatGrid,
  StatItem,
  StatusChip,
  SummaryCard,
} from '@/components/ui/dashboard';

type StoreCode = 'store_1';

type Availability = {
  storeCode: StoreCode;
  storeName: string;
  isOrderAheadEnabled: boolean;
  disabledReasonCode: string | null;
  disabledComment: string | null;
  updatedAt: string;
};

type CustomerMenuItem = {
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
};

type CustomerMenu = {
  storeCode: StoreCode;
  storeName: string;
  items: CustomerMenuItem[];
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

type Order = {
  id: string;
  customerIdentifier: string;
  storeCode: StoreCode;
  storeName: string;
  status: string;
  totalAmount: number;
  placedAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  noShowAt: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  lastEvent: {
    eventType: string;
    actorRole: string | null;
    metadataJson: Record<string, unknown> | null;
    createdAt: string;
  } | null;
  items: Array<{
    id: string;
    itemNameSnapshot: string;
    quantity: number;
    unitPriceAmount: number;
    lineTotalAmount: number;
  }>;
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

function getStatusLabel(status: string) {
  switch (status) {
    case 'pending_acceptance':
      return 'Pendiente';
    case 'accepted':
      return 'Aceptada';
    case 'rejected':
      return 'Rechazada';
    case 'cancelled_by_customer':
      return 'Cancelada';
    case 'ready_for_pickup':
      return 'Lista';
    case 'completed':
      return 'Completada';
    case 'no_show':
      return 'No-show';
    default:
      return status;
  }
}

function getStatusTone(status: string) {
  switch (status) {
    case 'pending_acceptance':
      return 'warning';
    case 'accepted':
    case 'ready_for_pickup':
      return 'info';
    case 'completed':
    case 'available':
      return 'success';
    case 'rejected':
    case 'cancelled_by_customer':
    case 'no_show':
    case 'unavailable':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function ClientHomePage() {
  const [storeCode, setStoreCode] = useState<StoreCode>('store_1');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [menu, setMenu] = useState<CustomerMenu | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerKey, setCustomerKey] = useState('demo-wallet-customer');
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletLookupPending, setWalletLookupPending] = useState(false);
  const [transferAmount, setTransferAmount] = useState('8000');
  const [transferReference, setTransferReference] = useState('TRX-DEMO-0002');
  const [transferPending, setTransferPending] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderActionError, setOrderActionError] = useState<string | null>(null);
  const [orderActionFeedback, setOrderActionFeedback] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadStoreData() {
      setError(null);
      setStoreLoading(true);

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
        setStoreLoading(false);
        return;
      }

      if (!menuResponse.ok) {
        setAvailability(availabilityPayload.availability as Availability);
        setMenu(null);
        setError(menuPayload.error ?? 'Could not load menu.');
        setStoreLoading(false);
        return;
      }

      const nextMenu = menuPayload.menu as CustomerMenu;
      setAvailability(availabilityPayload.availability as Availability);
      setMenu(nextMenu);
      setQuantities(
        Object.fromEntries(nextMenu.items.map((item) => [item.menuItemId, 0])) as Record<
          string,
          number
        >,
      );
      setStoreLoading(false);
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

  async function loadOrders(nextCustomerKey = customerKey) {
    const normalizedCustomerKey = nextCustomerKey.trim();
    if (!normalizedCustomerKey) {
      setOrders([]);
      setOrdersError('Debes ingresar una customer key.');
      return;
    }

    setOrdersLoading(true);
    const response = await fetch(
      `/api/customers/${encodeURIComponent(normalizedCustomerKey)}/orders`,
      {
        cache: 'no-store',
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      setOrders([]);
      setOrdersError(payload.error ?? 'No se pudieron cargar las órdenes.');
      setOrdersLoading(false);
      return;
    }

    setOrders((payload.orders as Order[]) ?? []);
    setOrdersError(null);
    setOrdersLoading(false);
  }

  useEffect(() => {
    void Promise.all([loadWalletData('demo-wallet-customer'), loadOrders('demo-wallet-customer')]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItems = useMemo(
    () =>
      (menu?.items ?? [])
        .map((item) => ({ item, quantity: quantities[item.menuItemId] ?? 0 }))
        .filter((entry) => entry.quantity > 0),
    [menu, quantities],
  );

  const orderTotal = selectedItems.reduce(
    (sum, entry) => sum + entry.item.priceAmount * entry.quantity,
    0,
  );

  async function onLookupWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWalletLookupPending(true);
    await Promise.all([loadWalletData(), loadOrders()]);
    setWalletLookupPending(false);
  }

  async function onTransferRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTransferPending(true);
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
      setTransferPending(false);
      return;
    }

    setWalletError(null);
    setTransferAmount('8000');
    await loadWalletData();
    setTransferPending(false);
  }

  async function onPlaceOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderActionError(null);
    setOrderActionFeedback(null);
    setPlacingOrder(true);

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerIdentifier: customerKey.trim(),
        storeCode,
        items: selectedItems.map(({ item, quantity }) => ({
          menuItemId: item.menuItemId,
          quantity,
        })),
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setOrderActionError(payload.error ?? 'No se pudo crear la orden.');
      setPlacingOrder(false);
      return;
    }

    if (menu) {
      setQuantities(
        Object.fromEntries(menu.items.map((item) => [item.menuItemId, 0])) as Record<
          string,
          number
        >,
      );
    }
    setOrderActionFeedback(
      'Orden creada correctamente. Revisa el tracking y el balance actualizado.',
    );
    await Promise.all([loadWalletData(), loadOrders()]);
    setPlacingOrder(false);
  }

  async function onCancelOrder(orderId: string) {
    setCancellingOrderId(orderId);
    setOrderActionError(null);
    setOrderActionFeedback(null);

    const response = await fetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Cancelado desde la vista cliente.' }),
    });
    const payload = await response.json();

    setCancellingOrderId(null);

    if (!response.ok) {
      setOrderActionError(payload.error ?? 'No se pudo cancelar la orden.');
      return;
    }

    setOrderActionFeedback(
      payload.transitionApplied === false
        ? 'La orden ya estaba cancelada; se actualizó el estado mostrado.'
        : 'Orden cancelada correctamente.',
    );
    await Promise.all([loadWalletData(), loadOrders()]);
  }

  return (
    <AppShell>
      <PageHeader>
        <div className="summary-card__title-row">
          <div className="stack">
            <span className="summary-card__eyebrow">Experiencia cliente</span>
            <h1>Cliente</h1>
            <p>
              Wallet, order-ahead y seguimiento reciente con una interfaz más confiable, escaneable
              y orientada a producto.
            </p>
          </div>
          <StatusChip label="Vista unificada" tone="info" />
        </div>
      </PageHeader>

      <SummaryCard>
        <div className="summary-card__title-row">
          <div className="stack">
            <span className="summary-card__eyebrow">Resumen rápido</span>
            <h2>{availability?.storeName ?? 'Tu próxima compra'}</h2>
            <p>
              Todo lo importante al inicio: sucursal, disponibilidad de order-ahead y saldo para
              comprar.
            </p>
          </div>
          <div className="field summary-card__control">
            <label className="field-label" htmlFor="store-select">
              Sucursal
            </label>
            <select
              id="store-select"
              value={storeCode}
              onChange={(event) => setStoreCode(event.target.value as StoreCode)}
            >
              <option value="store_1">Store 1</option>
            </select>
          </div>
        </div>
        <StatGrid>
          <StatItem
            label="Sucursal seleccionada"
            value={availability?.storeName ?? storeCode}
            helper={
              availability
                ? `Actualizado ${formatDateTime(availability.updatedAt)}`
                : 'Sin estado todavía'
            }
          />
          <StatItem
            label="Order-ahead"
            value={
              <StatusChip
                label={availability?.isOrderAheadEnabled ? 'Disponible' : 'No disponible'}
                tone={getStatusTone(
                  availability?.isOrderAheadEnabled ? 'available' : 'unavailable',
                )}
              />
            }
            helper={
              availability?.isOrderAheadEnabled
                ? 'Puedes pedir y pagar desde la wallet.'
                : (availability?.disabledReasonCode ?? 'Aún no disponible')
            }
          />
          <StatItem
            label="Wallet"
            value={walletSummary ? formatClp(walletSummary.currentBalance) : '—'}
            helper={walletSummary?.wallet.customerIdentifier ?? 'Busca tu wallet para ver saldo'}
          />
        </StatGrid>
        {!availability?.isOrderAheadEnabled && availability ? (
          <InlineFeedback
            tone="warning"
            message={`Order-ahead pausado${availability.disabledComment ? `: ${availability.disabledComment}` : '.'}`}
          />
        ) : null}
      </SummaryCard>

      <div className="page-columns">
        <div className="stack">
          <SectionCard>
            <CardHeader>
              <div className="stack">
                <h2>Mi wallet</h2>
                <p>
                  Saldo visible, búsqueda simple y solicitud de top-up en un bloque más claro y
                  confiable.
                </p>
              </div>
            </CardHeader>
            <div className="surface-soft stack">
              <p>
                Demo sugerida: <code>demo-wallet-customer</code>
              </p>
              <form onSubmit={onLookupWallet} className="form-row form-row--inline">
                <label className="field">
                  <span className="field-label">Customer key</span>
                  <input
                    aria-label="Customer key"
                    value={customerKey}
                    onChange={(event) => setCustomerKey(event.target.value)}
                    placeholder="customer key"
                  />
                </label>
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={walletLookupPending}
                >
                  {walletLookupPending ? 'Consultando…' : 'Ver wallet y órdenes'}
                </button>
              </form>
            </div>
            {walletError ? <InlineFeedback tone="error" message={walletError} /> : null}
            {walletLoading ? <LoadingBlock label="Actualizando balance y movimientos…" /> : null}
            {walletSummary ? (
              <>
                <StatGrid>
                  <StatItem label="Customer key" value={walletSummary.wallet.customerIdentifier} />
                  <StatItem
                    label="Balance actual"
                    value={formatClp(walletSummary.currentBalance)}
                  />
                  <StatItem label="Moneda" value={walletSummary.wallet.currencyCode} />
                </StatGrid>

                <div className="section-card compact-card" style={{ padding: '1rem' }}>
                  <div className="stack">
                    <h3>Solicitar top-up por transferencia</h3>
                    <p className="helper-text">
                      Completa la referencia para reducir errores y dejar trazabilidad del depósito.
                    </p>
                  </div>
                  <form
                    onSubmit={onTransferRequest}
                    className="form-grid form-grid--two compact-card"
                  >
                    <label className="field">
                      <span className="field-label">Monto</span>
                      <input
                        type="number"
                        min={1}
                        value={transferAmount}
                        onChange={(event) => setTransferAmount(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Referencia enviada</span>
                      <input
                        value={transferReference}
                        onChange={(event) => setTransferReference(event.target.value)}
                        placeholder="TRX-DEMO-0002"
                      />
                    </label>
                    <button
                      className="button button--primary"
                      type="submit"
                      disabled={transferPending}
                    >
                      {transferPending ? 'Enviando…' : 'Enviar solicitud manual'}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              !walletLoading && (
                <EmptyState
                  title="Busca tu wallet"
                  description="Ingresa tu customer key para ver saldo, historial y operar con confianza antes de pedir."
                />
              )
            )}
          </SectionCard>

          <SectionCard>
            <CardHeader>
              <div className="stack">
                <h2>Crear orden</h2>
                <p>
                  Controles de cantidad más claros, total destacado y CTA principal bien aislado.
                </p>
              </div>
              {availability ? (
                <StatusChip
                  label={availability.isOrderAheadEnabled ? 'Sucursal activa' : 'Sucursal pausada'}
                  tone={availability.isOrderAheadEnabled ? 'success' : 'warning'}
                />
              ) : null}
            </CardHeader>
            {error ? <InlineFeedback tone="error" message={error} /> : null}
            {orderActionError ? <InlineFeedback tone="error" message={orderActionError} /> : null}
            {orderActionFeedback ? (
              <InlineFeedback tone="success" message={orderActionFeedback} />
            ) : null}
            {storeLoading ? (
              <LoadingBlock label="Cargando catálogo y disponibilidad…" />
            ) : !menu ? (
              <EmptyState
                title="No pudimos cargar el menú"
                description="Reintenta más tarde o vuelve a seleccionar la sucursal."
              />
            ) : menu.items.length === 0 ? (
              <EmptyState
                title="Sin productos disponibles"
                description="Esta sucursal todavía no tiene productos visibles para order-ahead."
              />
            ) : (
              <form onSubmit={onPlaceOrder} className="stack">
                <div className="list-grid">
                  {menu.items.map((item) => {
                    const quantity = quantities[item.menuItemId] ?? 0;
                    return (
                      <article key={item.storeMenuItemId} className="menu-item-card compact-card">
                        <div className="menu-item-card__header">
                          <div className="stack" style={{ gap: '0.35rem' }}>
                            <strong>{item.name}</strong>
                            {item.description ? (
                              <span className="meta-text">{item.description}</span>
                            ) : null}
                            <div className="chip-row">
                              <StatusChip
                                label={item.isInStock ? 'Disponible' : 'Sin stock'}
                                tone={item.isInStock ? 'success' : 'warning'}
                              />
                            </div>
                          </div>
                          <strong>{formatClp(item.priceAmount)}</strong>
                        </div>
                        <div className="toolbar transaction-meta">
                          <div className="quantity-control" aria-label={`Cantidad de ${item.name}`}>
                            <button
                              type="button"
                              onClick={() =>
                                setQuantities((current) => ({
                                  ...current,
                                  [item.menuItemId]: Math.max(
                                    0,
                                    (current[item.menuItemId] ?? 0) - 1,
                                  ),
                                }))
                              }
                              disabled={!item.isInStock || quantity === 0}
                            >
                              −
                            </button>
                            <span className="quantity-display">{quantity}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setQuantities((current) => ({
                                  ...current,
                                  [item.menuItemId]: (current[item.menuItemId] ?? 0) + 1,
                                }))
                              }
                              disabled={!item.isInStock}
                            >
                              +
                            </button>
                          </div>
                          <span className="meta-text">
                            {quantity > 0
                              ? `Subtotal ${formatClp(quantity * item.priceAmount)}`
                              : 'Aún no agregado'}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="surface-soft stack compact-card">
                  <div className="toolbar transaction-meta">
                    <div className="stack" style={{ gap: '0.2rem' }}>
                      <span className="row-label">Total estimado</span>
                      <strong style={{ fontSize: '1.6rem' }}>{formatClp(orderTotal)}</strong>
                    </div>
                    <div className="stack" style={{ gap: '0.2rem', alignItems: 'flex-end' }}>
                      <span className="row-label">Productos seleccionados</span>
                      <strong>{selectedItems.length}</strong>
                    </div>
                  </div>
                  <button
                    className="button button--primary button--block"
                    type="submit"
                    disabled={
                      selectedItems.length === 0 ||
                      placingOrder ||
                      !availability?.isOrderAheadEnabled
                    }
                  >
                    {placingOrder ? 'Confirmando…' : 'Confirmar orden con wallet'}
                  </button>
                  {!availability?.isOrderAheadEnabled ? (
                    <span className="field-help">
                      La sucursal debe estar disponible para poder crear una orden.
                    </span>
                  ) : null}
                </div>
              </form>
            )}
          </SectionCard>

          <SectionCard>
            <CardHeader>
              <div className="stack">
                <h2>Mis órdenes recientes</h2>
                <p>Seguimiento más claro de estado, tiempos y ventana segura de cancelación.</p>
              </div>
            </CardHeader>
            {ordersError ? <InlineFeedback tone="error" message={ordersError} /> : null}
            {ordersLoading ? (
              <LoadingBlock label="Cargando órdenes recientes…" />
            ) : orders.length === 0 ? (
              <EmptyState
                title="Todavía no tienes órdenes"
                description="Cuando hagas tu primer pedido aparecerá aquí con su tracking completo."
              />
            ) : (
              <div className="list-grid">
                {orders.map((order) => {
                  const cancellationDeadlineMs = new Date(order.placedAt).getTime() + 5 * 60 * 1000;
                  const remainingMs = cancellationDeadlineMs - Date.now();
                  const canCancel = order.status === 'pending_acceptance' && remainingMs > 0;
                  const remainingWholeMinutes = Math.max(0, Math.ceil(remainingMs / 60000));

                  return (
                    <article key={order.id} className="order-card compact-card">
                      <div className="order-card__header">
                        <div className="stack" style={{ gap: '0.4rem' }}>
                          <div className="chip-row">
                            <StatusChip
                              label={getStatusLabel(order.status)}
                              tone={getStatusTone(order.status)}
                            />
                            {order.status === 'pending_acceptance' ? (
                              <StatusChip
                                label={
                                  canCancel
                                    ? `Cancelable ~${remainingWholeMinutes} min`
                                    : 'Cancelación expirada'
                                }
                                tone={canCancel ? 'warning' : 'muted'}
                              />
                            ) : null}
                          </div>
                          <strong>{formatClp(order.totalAmount)}</strong>
                          <span className="meta-text">Orden {order.id}</span>
                        </div>
                        <div className="stack" style={{ gap: '0.3rem', maxWidth: 320 }}>
                          <span className="row-label">Tienda</span>
                          <strong>{order.storeName}</strong>
                          <span className="meta-text">Creada {formatDateTime(order.placedAt)}</span>
                        </div>
                      </div>

                      <div className="order-card__metrics">
                        <div className="meta-block">
                          <span className="row-label">Aceptada</span>
                          <strong>
                            {order.acceptedAt ? formatDateTime(order.acceptedAt) : '—'}
                          </strong>
                        </div>
                        <div className="meta-block">
                          <span className="row-label">Lista</span>
                          <strong>{order.readyAt ? formatDateTime(order.readyAt) : '—'}</strong>
                        </div>
                        <div className="meta-block">
                          <span className="row-label">Completada</span>
                          <strong>
                            {order.completedAt ? formatDateTime(order.completedAt) : '—'}
                          </strong>
                        </div>
                        <div className="meta-block">
                          <span className="row-label">No-show</span>
                          <strong>{order.noShowAt ? formatDateTime(order.noShowAt) : '—'}</strong>
                        </div>
                      </div>

                      <div className="surface-soft stack compact-card">
                        <div className="order-items">
                          {order.items.map((item) => (
                            <div key={item.id} className="order-item-row">
                              <span>
                                {item.itemNameSnapshot} x{item.quantity}
                              </span>
                              <strong>{formatClp(item.lineTotalAmount)}</strong>
                            </div>
                          ))}
                        </div>
                        {order.rejectionReason ? (
                          <InlineFeedback
                            tone="warning"
                            message={`Motivo rechazo: ${order.rejectionReason}`}
                          />
                        ) : null}
                        {order.cancellationReason ? (
                          <InlineFeedback
                            tone="warning"
                            message={`Motivo cancelación: ${order.cancellationReason}`}
                          />
                        ) : null}
                      </div>

                      {canCancel ? (
                        <button
                          className="button button--soft-danger"
                          type="button"
                          onClick={() => onCancelOrder(order.id)}
                          disabled={cancellingOrderId === order.id}
                        >
                          {cancellingOrderId === order.id
                            ? 'Cancelando…'
                            : 'Cancelar dentro de 5 minutos'}
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="stack">
          <SectionCard>
            <CardHeader>
              <div className="stack">
                <h2>Historial de transacciones</h2>
                <p>Movimientos agrupados con monto, estado y referencias para generar confianza.</p>
              </div>
            </CardHeader>
            {walletLoading && walletTransactions.length === 0 ? (
              <LoadingBlock label="Cargando movimientos…" />
            ) : walletTransactions.length === 0 ? (
              <EmptyState
                title="Sin movimientos todavía"
                description="Tus top-ups y pagos aparecerán aquí apenas existan transacciones en la wallet."
              />
            ) : (
              <div className="list-grid compact-list">
                {walletTransactions.map((transaction) => (
                  <div key={transaction.id} className="transaction-row compact-card">
                    <div className="stack" style={{ gap: '0.35rem' }}>
                      <div className="chip-row">
                        <StatusChip label={transaction.entryType} tone="muted" />
                        <StatusChip
                          label={transaction.status}
                          tone={getStatusTone(transaction.status)}
                        />
                      </div>
                      <strong>{formatClp(transaction.amountSigned)}</strong>
                      <span className="meta-text">{formatDateTime(transaction.createdAt)}</span>
                    </div>
                    <div className="stack" style={{ gap: '0.35rem', maxWidth: 300 }}>
                      {transaction.referenceType ? (
                        <span className="meta-text">
                          Ref: {transaction.referenceType} / {transaction.referenceId ?? '—'}
                        </span>
                      ) : null}
                      {transaction.note ? <span>{transaction.note}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
