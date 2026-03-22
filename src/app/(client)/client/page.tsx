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

const INTERNAL_CUSTOMER_IDENTIFIER = 'demo-wallet-customer';
const ORDER_REFRESH_INTERVAL_MS = 15000;

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

function getAvailabilityMessage(availability: Availability | null) {
  if (!availability) {
    return 'Estamos revisando si la tienda está lista para recibir tu pedido.';
  }

  if (availability.isOrderAheadEnabled) {
    return 'Puedes pedir ahora y pasar a retirar cuando te avisemos.';
  }

  switch (availability.disabledReasonCode) {
    case 'manual_pause':
      return 'La tienda pausó temporalmente los pedidos online.';
    case 'equipment_issue':
      return 'Estamos resolviendo un problema de preparación en tienda.';
    case 'staffing_issue':
      return 'La tienda está con menor capacidad para preparar pedidos ahora.';
    case 'inventory_issue':
      return 'Faltan productos para atender pedidos con normalidad.';
    case 'system_issue':
      return 'Estamos teniendo un problema temporal para recibir pedidos.';
    case 'other':
      return availability.disabledComment ?? 'En este momento la tienda no puede recibir pedidos.';
    default:
      return availability.disabledComment ?? 'En este momento la tienda no puede recibir pedidos.';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'pending_acceptance':
      return 'Recibido';
    case 'accepted':
      return 'En preparación';
    case 'ready_for_pickup':
      return 'Listo para retiro';
    case 'rejected':
      return 'Rechazado';
    case 'cancelled_by_customer':
      return 'Cancelado';
    case 'completed':
      return 'Retirado';
    case 'no_show':
      return 'No retirado';
    default:
      return status;
  }
}

function getStatusTone(status: string) {
  switch (status) {
    case 'pending_acceptance':
      return 'warning';
    case 'accepted':
      return 'info';
    case 'ready_for_pickup':
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

function getTrackingHeadline(order: Order) {
  switch (order.status) {
    case 'pending_acceptance':
      return 'Tu pedido ya entró a la tienda.';
    case 'accepted':
      return 'Tu pedido se está preparando.';
    case 'ready_for_pickup':
      return 'Tu pedido está listo para retiro.';
    case 'rejected':
      return 'No pudimos preparar este pedido.';
    case 'cancelled_by_customer':
      return 'Este pedido fue cancelado.';
    case 'completed':
      return 'Pedido retirado con éxito.';
    case 'no_show':
      return 'El pedido no fue retirado a tiempo.';
    default:
      return 'Estamos actualizando tu pedido.';
  }
}

function getTrackingSupport(order: Order) {
  switch (order.status) {
    case 'pending_acceptance':
      return `Recibido ${formatDateTime(order.placedAt)}.`;
    case 'accepted':
      return order.acceptedAt
        ? `En preparación desde ${formatDateTime(order.acceptedAt)}.`
        : 'La tienda confirmó tu pedido y ya comenzó a prepararlo.';
    case 'ready_for_pickup':
      return order.readyAt
        ? `Listo para retiro desde ${formatDateTime(order.readyAt)}.`
        : 'Pasa por la tienda cuando te acomode.';
    case 'rejected':
      return order.rejectionReason ?? 'La tienda rechazó el pedido.';
    case 'cancelled_by_customer':
      return order.cancellationReason ?? 'Cancelaste el pedido desde esta vista.';
    case 'completed':
      return order.completedAt
        ? `Retirado ${formatDateTime(order.completedAt)}.`
        : 'El pedido ya fue retirado.';
    case 'no_show':
      return order.noShowAt
        ? `Marcado como no retirado ${formatDateTime(order.noShowAt)}.`
        : 'La tienda marcó el pedido como no retirado.';
    default:
      return 'Sigue aquí el estado más reciente de tu pedido.';
  }
}

export default function ClientHomePage() {
  const [storeCode, setStoreCode] = useState<StoreCode>('store_1');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [menu, setMenu] = useState<CustomerMenu | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        setError(availabilityPayload.error ?? 'No pudimos revisar la disponibilidad.');
        setStoreLoading(false);
        return;
      }

      if (!menuResponse.ok) {
        setAvailability(availabilityPayload.availability as Availability);
        setMenu(null);
        setError(menuPayload.error ?? 'No pudimos cargar el menú.');
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

  async function loadOrders() {
    setOrdersLoading(true);
    const response = await fetch(
      `/api/customers/${encodeURIComponent(INTERNAL_CUSTOMER_IDENTIFIER)}/orders`,
      {
        cache: 'no-store',
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      setOrders([]);
      setOrdersError(payload.error ?? 'No pudimos cargar tu pedido actual.');
      setOrdersLoading(false);
      return;
    }

    setOrders((payload.orders as Order[]) ?? []);
    setOrdersError(null);
    setOrdersLoading(false);
  }

  useEffect(() => {
    void loadOrders();

    const intervalId = window.setInterval(() => {
      void loadOrders();
    }, ORDER_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const visibleMenuItems = useMemo(
    () =>
      [...(menu?.items ?? [])]
        .filter((item) => item.isVisible && item.baseIsActive)
        .sort((left, right) => {
          const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;
          return leftOrder - rightOrder || left.name.localeCompare(right.name, 'es');
        }),
    [menu],
  );

  const selectedItems = useMemo(
    () =>
      visibleMenuItems
        .map((item) => ({ item, quantity: quantities[item.menuItemId] ?? 0 }))
        .filter((entry) => entry.quantity > 0),
    [visibleMenuItems, quantities],
  );

  const orderTotal = selectedItems.reduce(
    (sum, entry) => sum + entry.item.priceAmount * entry.quantity,
    0,
  );

  const sortedOrders = useMemo(
    () => [...orders].sort((left, right) => +new Date(right.placedAt) - +new Date(left.placedAt)),
    [orders],
  );

  const featuredOrder = useMemo(
    () =>
      sortedOrders.find((order) =>
        ['pending_acceptance', 'accepted', 'ready_for_pickup'].includes(order.status),
      ) ?? sortedOrders[0] ?? null,
    [sortedOrders],
  );

  const recentOrders = useMemo(
    () => sortedOrders.filter((order) => order.id !== featuredOrder?.id).slice(0, 3),
    [featuredOrder?.id, sortedOrders],
  );

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
        customerIdentifier: INTERNAL_CUSTOMER_IDENTIFIER,
        storeCode,
        items: selectedItems.map(({ item, quantity }) => ({
          menuItemId: item.menuItemId,
          quantity,
        })),
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setOrderActionError(payload.error ?? 'No pudimos crear tu pedido.');
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

    setOrderActionFeedback('Pedido enviado. Aquí mismo verás cuándo esté listo para retiro.');
    await loadOrders();
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
      setOrderActionError(payload.error ?? 'No pudimos cancelar tu pedido.');
      return;
    }

    setOrderActionFeedback(
      payload.transitionApplied === false
        ? 'Actualizamos el estado más reciente de tu pedido.'
        : 'Pedido cancelado correctamente.',
    );
    await loadOrders();
  }

  return (
    <AppShell>
      <PageHeader>
        <div className="summary-card__title-row">
          <div className="stack">
            <span className="summary-card__eyebrow">Order ahead</span>
            <h1>Pide antes de llegar</h1>
            <p>Revisa si la tienda está disponible, arma tu café y sigue el estado hasta retiro.</p>
          </div>
          <div className="field summary-card__control">
            <label className="field-label" htmlFor="store-select">
              Tienda
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
      </PageHeader>

      <SummaryCard>
        <div className="summary-card__title-row">
          <div className="stack">
            <span className="summary-card__eyebrow">1. Disponibilidad</span>
            <h2>{availability?.storeName ?? 'Tu tienda'}</h2>
            <p>{getAvailabilityMessage(availability)}</p>
          </div>
          <StatusChip
            label={availability?.isOrderAheadEnabled ? 'Disponible' : 'No disponible'}
            tone={getStatusTone(availability?.isOrderAheadEnabled ? 'available' : 'unavailable')}
          />
        </div>
        <StatGrid>
          <StatItem
            label="Tienda"
            value={availability?.storeName ?? storeCode}
            helper={availability ? `Actualizado ${formatDateTime(availability.updatedAt)}` : 'Cargando'}
          />
          <StatItem
            label="Estado"
            value={availability?.isOrderAheadEnabled ? 'Puedes pedir ahora' : 'Pedidos pausados'}
            helper={availability?.isOrderAheadEnabled ? 'Retiro rápido en tienda.' : 'Te avisamos aquí cuando vuelva.'}
          />
          <StatItem
            label="Qué sigue"
            value={availability?.isOrderAheadEnabled ? 'Elige tu pedido' : 'Vuelve a intentar más tarde'}
            helper={availability?.isOrderAheadEnabled ? 'Agrega productos y confirma.' : 'La tienda no está recibiendo pedidos ahora.'}
          />
        </StatGrid>
        {!availability?.isOrderAheadEnabled && availability ? (
          <InlineFeedback
            tone="warning"
            message={availability.disabledComment ?? getAvailabilityMessage(availability)}
          />
        ) : null}
        {error ? <InlineFeedback tone="error" message={error} /> : null}
      </SummaryCard>

      <SectionCard>
        <CardHeader>
          <div className="stack">
            <span className="summary-card__eyebrow">2. Elige y pide</span>
            <h2>Menú para pedir rápido</h2>
            <p>Selecciona cantidades, revisa el total y confirma en un solo paso.</p>
          </div>
          {availability ? (
            <StatusChip
              label={availability.isOrderAheadEnabled ? 'Listo para pedir' : 'Pausa temporal'}
              tone={availability.isOrderAheadEnabled ? 'success' : 'warning'}
            />
          ) : null}
        </CardHeader>
        {orderActionError ? <InlineFeedback tone="error" message={orderActionError} /> : null}
        {orderActionFeedback ? <InlineFeedback tone="success" message={orderActionFeedback} /> : null}
        {storeLoading ? (
          <LoadingBlock label="Cargando menú…" />
        ) : !menu ? (
          <EmptyState
            title="No pudimos cargar el menú"
            description="Vuelve a intentar en unos minutos o cambia de tienda."
          />
        ) : visibleMenuItems.length === 0 ? (
          <EmptyState
            title="No hay productos disponibles"
            description="Esta tienda todavía no tiene productos listos para order ahead."
          />
        ) : (
          <form onSubmit={onPlaceOrder} className="stack">
            <div className="list-grid">
              {visibleMenuItems.map((item) => {
                const quantity = quantities[item.menuItemId] ?? 0;

                return (
                  <article key={item.storeMenuItemId} className="menu-item-card compact-card">
                    <div className="menu-item-card__header">
                      <div className="stack" style={{ gap: '0.35rem' }}>
                        <strong>{item.name}</strong>
                        {item.description ? <span className="meta-text">{item.description}</span> : null}
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
                              [item.menuItemId]: Math.max(0, (current[item.menuItemId] ?? 0) - 1),
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
                          : 'Toca + para agregar'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="surface-soft stack compact-card">
              <div className="toolbar transaction-meta">
                <div className="stack" style={{ gap: '0.2rem' }}>
                  <span className="row-label">Total</span>
                  <strong style={{ fontSize: '1.8rem' }}>{formatClp(orderTotal)}</strong>
                </div>
                <div className="stack" style={{ gap: '0.2rem', alignItems: 'flex-end' }}>
                  <span className="row-label">Productos</span>
                  <strong>{selectedItems.reduce((sum, entry) => sum + entry.quantity, 0)}</strong>
                </div>
              </div>
              <button
                className="button button--primary button--block"
                type="submit"
                disabled={selectedItems.length === 0 || placingOrder || !availability?.isOrderAheadEnabled}
              >
                {placingOrder ? 'Enviando pedido…' : 'Pedir ahora'}
              </button>
              {!availability?.isOrderAheadEnabled ? (
                <span className="field-help">La tienda debe estar disponible para confirmar tu pedido.</span>
              ) : null}
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard>
        <CardHeader>
          <div className="stack">
            <span className="summary-card__eyebrow">3. Sigue tu pedido</span>
            <h2>Estado actual</h2>
            <p>Te mostramos primero lo que importa para saber cuándo pasar a retirar.</p>
          </div>
          <StatusChip
            label={featuredOrder ? getStatusLabel(featuredOrder.status) : 'Sin pedido activo'}
            tone={getStatusTone(featuredOrder?.status ?? 'neutral')}
          />
        </CardHeader>
        {ordersError ? <InlineFeedback tone="error" message={ordersError} /> : null}
        {ordersLoading && orders.length === 0 ? (
          <LoadingBlock label="Buscando tu pedido actual…" />
        ) : !featuredOrder ? (
          <EmptyState
            title="Todavía no hay un pedido para seguir"
            description="Cuando confirmes tu pedido, verás aquí si fue recibido, está en preparación o listo para retiro."
          />
        ) : (
          <div className="stack">
            <article className="order-card compact-card">
              <div className="order-card__header">
                <div className="stack" style={{ gap: '0.4rem' }}>
                  <div className="chip-row">
                    <StatusChip
                      label={getStatusLabel(featuredOrder.status)}
                      tone={getStatusTone(featuredOrder.status)}
                    />
                  </div>
                  <strong>{getTrackingHeadline(featuredOrder)}</strong>
                  <span className="meta-text">{getTrackingSupport(featuredOrder)}</span>
                </div>
                <div className="stack" style={{ gap: '0.3rem', maxWidth: 320 }}>
                  <span className="row-label">Total</span>
                  <strong>{formatClp(featuredOrder.totalAmount)}</strong>
                  <span className="meta-text">Pedido {featuredOrder.id}</span>
                </div>
              </div>

              <div className="order-card__metrics">
                <div className="meta-block">
                  <span className="row-label">Recibido</span>
                  <strong>{formatDateTime(featuredOrder.placedAt)}</strong>
                </div>
                <div className="meta-block">
                  <span className="row-label">En preparación</span>
                  <strong>
                    {featuredOrder.acceptedAt ? formatDateTime(featuredOrder.acceptedAt) : 'Aún no'}
                  </strong>
                </div>
                <div className="meta-block">
                  <span className="row-label">Listo para retiro</span>
                  <strong>{featuredOrder.readyAt ? formatDateTime(featuredOrder.readyAt) : 'Aún no'}</strong>
                </div>
              </div>

              <div className="surface-soft stack compact-card">
                <div className="order-items">
                  {featuredOrder.items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <span>
                        {item.itemNameSnapshot} x{item.quantity}
                      </span>
                      <strong>{formatClp(item.lineTotalAmount)}</strong>
                    </div>
                  ))}
                </div>
                {featuredOrder.rejectionReason ? (
                  <InlineFeedback tone="warning" message={featuredOrder.rejectionReason} />
                ) : null}
                {featuredOrder.cancellationReason ? (
                  <InlineFeedback tone="warning" message={featuredOrder.cancellationReason} />
                ) : null}
              </div>

              {featuredOrder.status === 'pending_acceptance' ? (
                <button
                  className="button button--soft-danger"
                  type="button"
                  onClick={() => onCancelOrder(featuredOrder.id)}
                  disabled={cancellingOrderId === featuredOrder.id}
                >
                  {cancellingOrderId === featuredOrder.id ? 'Cancelando…' : 'Cancelar pedido'}
                </button>
              ) : null}
            </article>

            {recentOrders.length > 0 ? (
              <div className="stack" style={{ gap: '0.75rem' }}>
                <span className="row-label">Pedidos recientes</span>
                <div className="list-grid compact-list">
                  {recentOrders.map((order) => (
                    <article key={order.id} className="menu-item-card compact-card">
                      <div className="menu-item-card__header">
                        <div className="stack" style={{ gap: '0.3rem' }}>
                          <strong>{getStatusLabel(order.status)}</strong>
                          <span className="meta-text">{formatDateTime(order.placedAt)}</span>
                        </div>
                        <strong>{formatClp(order.totalAmount)}</strong>
                      </div>
                      <span className="meta-text">{getTrackingSupport(order)}</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
