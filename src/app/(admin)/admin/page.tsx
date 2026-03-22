'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  buildOrderActionFeedback,
  countRecentRejectedOrders,
  getAdminNotificationStatusLabel,
  getAdminNotificationTypeLabel,
  getAdminOrderStatusLabel,
  getPendingAcceptancePreventionMessages,
} from '@/app/(admin)/admin/order-workflow';
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

type OrderNotification = {
  id: string;
  notificationType: string;
  channel: string;
  status: string;
  payloadJson: Record<string, unknown> | null;
  failureReason: string | null;
  attemptCount: number;
  createdAt: string;
  processedAt: string | null;
  updatedAt: string;
};

type AdminOrder = {
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
    actorUserId: string | null;
    actorRole: string | null;
    metadataJson: Record<string, unknown> | null;
    createdAt: string;
  } | null;
  items: Array<{
    id: string;
    itemNameSnapshot: string;
    quantity: number;
  }>;
  notifications: OrderNotification[];
};

type OrderActionName =
  | 'accept'
  | 'ready'
  | 'complete'
  | 'reject'
  | 'no-show'
  | 'retry-notification';
type OrderStatusFilter =
  | 'all'
  | 'pending_acceptance'
  | 'accepted'
  | 'rejected'
  | 'cancelled_by_customer'
  | 'ready_for_pickup'
  | 'completed'
  | 'no_show';

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

function getStatusTone(status: string) {
  switch (status) {
    case 'pending_acceptance':
      return 'warning';
    case 'accepted':
    case 'ready_for_pickup':
      return 'info';
    case 'completed':
    case 'active':
      return 'success';
    case 'rejected':
    case 'cancelled_by_customer':
    case 'inactive':
    case 'no_show':
      return 'danger';
    default:
      return 'neutral';
  }
}

function getNextActionHint(status: AdminOrder['status']) {
  switch (status) {
    case 'pending_acceptance':
      return 'Siguiente paso recomendado: aceptar o rechazar con motivo.';
    case 'accepted':
      return 'Siguiente paso recomendado: marcar lista o registrar no-show si no retira.';
    case 'ready_for_pickup':
      return 'Siguiente paso recomendado: completar al entregar o registrar no-show.';
    default:
      return 'Esta orden no requiere acción operativa inmediata.';
  }
}

function getNotificationStatusTone(status: string) {
  switch (status) {
    case 'sent':
      return 'success';
    case 'failed':
      return 'danger';
    case 'pending':
      return 'warning';
    case 'skipped':
      return 'muted';
    default:
      return 'neutral';
  }
}

export default function AdminHomePage() {
  const router = useRouter();
  const [storeCode, setStoreCode] = useState<StoreCode>('store_1');
  const [newIsEnabled, setNewIsEnabled] = useState(true);
  const [reasonCode, setReasonCode] = useState('manual_pause');
  const [comment, setComment] = useState('');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewSaving, setOverviewSaving] = useState(false);
  const [menuOverview, setMenuOverview] = useState<MenuOverview | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [attachMenuItemId, setAttachMenuItemId] = useState('');
  const [attachPriceAmount, setAttachPriceAmount] = useState('2500');
  const [menuActionLoading, setMenuActionLoading] = useState<string | null>(null);

  const [walletCustomerKey, setWalletCustomerKey] = useState('demo-wallet-customer');
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletLookupPending, setWalletLookupPending] = useState(false);
  const [cashTopupAmount, setCashTopupAmount] = useState('5000');
  const [cashTopupNote, setCashTopupNote] = useState('Carga en caja');
  const [cashTopupPending, setCashTopupPending] = useState(false);
  const [adjustmentDirection, setAdjustmentDirection] = useState<'credit' | 'debit'>('credit');
  const [adjustmentAmount, setAdjustmentAmount] = useState('1000');
  const [adjustmentNote, setAdjustmentNote] = useState('Ajuste operativo');
  const [adjustmentPending, setAdjustmentPending] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('all');
  const [orderActionPending, setOrderActionPending] = useState<
    Record<string, OrderActionName | null>
  >({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [noShowReasons, setNoShowReasons] = useState<Record<string, string>>({});

  const actionableOrders = useMemo(
    () =>
      orders.filter((order) =>
        ['pending_acceptance', 'accepted', 'ready_for_pickup'].includes(order.status),
      ).length,
    [orders],
  );

  const recentRejectedOrders = useMemo(() => countRecentRejectedOrders(orders), [orders]);
  const storeWideIssuePromptVisible =
    overview?.availability.isOrderAheadEnabled === true && recentRejectedOrders >= 2;

  async function loadOverview() {
    setOverviewLoading(true);
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
      setOverviewLoading(false);
      return;
    }

    setError(null);
    setOverview(payload as AdminOverview);
    setNewIsEnabled(payload.availability.isOrderAheadEnabled as boolean);
    setReasonCode(payload.availability.disabledReasonCode ?? 'manual_pause');
    setComment(payload.availability.disabledComment ?? '');
    setOverviewLoading(false);
  }

  async function loadMenuOverview() {
    setMenuLoading(true);
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
      setMenuLoading(false);
      return;
    }

    setMenuError(null);
    setMenuOverview(payload.menu as MenuOverview);

    const nextAttachId = (payload.menu as MenuOverview).availableBaseItems[0]?.id ?? '';
    setAttachMenuItemId((current) => current || nextAttachId);
    setMenuLoading(false);
  }

  async function loadOrders() {
    setOrdersLoading(true);
    const statusQuery =
      orderStatusFilter === 'all' ? '' : `?status=${encodeURIComponent(orderStatusFilter)}`;
    const response = await fetch(`/api/admin/stores/${storeCode}/orders${statusQuery}`, {
      cache: 'no-store',
    });
    const payload = await response.json();

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setOrdersError(payload.error ?? 'Could not load store orders.');
      setOrdersLoading(false);
      return;
    }

    setOrders((payload.orders as AdminOrder[]) ?? []);
    setOrdersError(null);
    setOrdersLoading(false);
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
    void Promise.all([loadOverview(), loadMenuOverview(), loadOrders()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCode, orderStatusFilter]);

  useEffect(() => {
    void loadWalletData('demo-wallet-customer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmitOrderAhead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOverviewSaving(true);
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
      setOverviewSaving(false);
      return;
    }

    await loadOverview();
    setOverviewSaving(false);
  }

  async function onCreateBaseItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMenuActionLoading('create');
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
      setMenuActionLoading(null);
      return;
    }

    setCreateCode('');
    setCreateName('');
    setCreateDescription('');
    await loadMenuOverview();
    setMenuActionLoading(null);
  }

  async function onAttachItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMenuActionLoading('attach');

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
      setMenuActionLoading(null);
      return;
    }

    setAttachPriceAmount('2500');
    await loadMenuOverview();
    setMenuActionLoading(null);
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
    setMenuActionLoading(menuItemId);
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
      setMenuActionLoading(null);
      return;
    }

    await loadMenuOverview();
    setMenuActionLoading(null);
  }

  async function onLookupWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWalletLookupPending(true);
    await loadWalletData();
    setWalletLookupPending(false);
  }

  async function onCashTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCashTopupPending(true);
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
      setCashTopupPending(false);
      return;
    }

    setWalletError(null);
    setCashTopupAmount('5000');
    await loadWalletData();
    setCashTopupPending(false);
  }

  async function onAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdjustmentPending(true);
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
      setAdjustmentPending(false);
      return;
    }

    setWalletError(null);
    await loadWalletData();
    setAdjustmentPending(false);
  }

  async function submitOrderAction(
    orderId: string,
    action: OrderActionName,
    body?: Record<string, unknown>,
  ) {
    setOrdersError(null);
    setOrderFeedback(null);
    setOrderActionPending((current) => ({ ...current, [orderId]: action }));

    const response = await fetch(`/api/admin/orders/${orderId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body ?? {}),
    });
    const payload = await response.json();

    setOrderActionPending((current) => ({ ...current, [orderId]: null }));

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setOrdersError(payload.error ?? 'No se pudo actualizar la orden.');
      return;
    }

    setOrderFeedback(buildOrderActionFeedback(action, payload));

    if (action === 'reject') {
      setRejectReasons((current) => ({ ...current, [orderId]: '' }));
    }

    if (action === 'no-show') {
      setNoShowReasons((current) => ({ ...current, [orderId]: '' }));
    }

    await loadOrders();
  }

  async function onOrderAction(orderId: string, action: 'accept' | 'ready' | 'complete') {
    await submitOrderAction(orderId, action);
  }

  async function onRejectOrder(orderId: string) {
    const reason = rejectReasons[orderId]?.trim();
    if (!reason) {
      setOrdersError('Debes ingresar un motivo de rechazo.');
      return;
    }

    await submitOrderAction(orderId, 'reject', { reason });
  }

  async function onNoShowOrder(orderId: string) {
    const reason = noShowReasons[orderId]?.trim();
    if (!reason) {
      setOrdersError('Debes ingresar una nota para registrar el no-show.');
      return;
    }

    await submitOrderAction(orderId, 'no-show', { reason });
  }

  async function onRetryNotification(orderId: string, notificationId: string) {
    setOrdersError(null);
    setOrderFeedback(null);
    setOrderActionPending((current) => ({ ...current, [notificationId]: 'retry-notification' }));

    const response = await fetch(
      `/api/admin/orders/${orderId}/notifications/${notificationId}/retry`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );
    const payload = await response.json();

    setOrderActionPending((current) => ({ ...current, [notificationId]: null }));

    if (response.status === 401) {
      router.push('/admin/login');
      return;
    }

    if (!response.ok) {
      setOrdersError(payload.error ?? 'No se pudo reintentar la notificación.');
      return;
    }

    setOrderFeedback(buildOrderActionFeedback('reintentar notificación', payload));
    await loadOrders();
  }

  function jumpToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function prefillPause(reason: string, nextComment: string) {
    setNewIsEnabled(false);
    setReasonCode(reason);
    setComment((current) => current || nextComment);
    setOrderFeedback(
      'Se preparó una pausa operativa para esta sucursal. Revisa el motivo en Order-ahead y guarda el estado antes de seguir rechazando.',
    );
    jumpToSection('admin-order-ahead');
  }

  function jumpToMenuStock() {
    setOrderFeedback(
      'Revisa el menú de la sucursal y marca los ítems afectados como sin stock para prevenir nuevos pedidos rechazables.',
    );
    jumpToSection('admin-menu');
  }

  return (
    <AppShell>
      <PageHeader>
        <div className="summary-card__title-row">
          <div className="stack">
            <span className="summary-card__eyebrow">Panel operativo</span>
            <h1>Admin</h1>
            <p>
              Operación de order-ahead, menú, órdenes y wallet prepaga con una jerarquía visual más
              clara para caja y backoffice.
            </p>
          </div>
          <StatusChip label="Lógica intacta" tone="success" />
        </div>
        <p>
          Las cargas por caja aceptan owner/barista. Los ajustes admin quedan validados owner-only
          en backend.
        </p>
      </PageHeader>

      <SummaryCard>
        <div className="summary-card__title-row">
          <div className="stack">
            <span className="summary-card__eyebrow">Control panel</span>
            <h2>{overview?.availability.storeName ?? 'Sucursal seleccionada'}</h2>
            <p>
              Selector de sucursal, estado operativo y órdenes que requieren atención inmediata.
            </p>
          </div>
          <div className="field summary-card__control">
            <label className="field-label" htmlFor="store-select">
              Sucursal activa
            </label>
            <select
              id="store-select"
              value={storeCode}
              onChange={(event) => setStoreCode(event.target.value as StoreCode)}
            >
              <option value="store_1">Store 1</option>
              <option value="store_2">Store 2</option>
              <option value="store_3">Store 3</option>
            </select>
          </div>
        </div>
        <StatGrid>
          <StatItem
            label="Order-ahead"
            value={
              <StatusChip
                label={overview?.availability.isOrderAheadEnabled ? 'Activo' : 'Pausado'}
                tone={overview?.availability.isOrderAheadEnabled ? 'success' : 'danger'}
              />
            }
            helper={
              overview
                ? `Actualizado ${formatDateTime(overview.availability.updatedAt)}`
                : 'Sin datos aún'
            }
          />
          <StatItem
            label="Órdenes accionables"
            value={actionableOrders}
            helper="Pendientes, aceptadas o listas"
          />
          <StatItem
            label="Wallet consultada"
            value={walletSummary ? formatClp(walletSummary.currentBalance) : '—'}
            helper={walletSummary?.wallet.customerIdentifier ?? 'Busca una wallet para operar'}
          />
        </StatGrid>
      </SummaryCard>

      <div className="page-columns">
        <div className="stack">
          <div id="admin-order-ahead">
            <SectionCard>
              <CardHeader>
                <div className="stack">
                  <h2>Order-ahead</h2>
                  <p>
                    Haz visible el estado actual, previene errores y deja evidencia del motivo
                    cuando pausas la tienda.
                  </p>
                </div>
              </CardHeader>
              {error ? <InlineFeedback tone="error" message={error} /> : null}
              {overviewLoading ? (
                <LoadingBlock label="Cargando disponibilidad y bitácora…" />
              ) : overview ? (
                <>
                  <div className="surface-soft stack">
                    <div className="toolbar">
                      <div className="stack" style={{ gap: '0.35rem' }}>
                        <span className="kicker">Estado actual</span>
                        <div className="chip-row">
                          <StatusChip
                            label={
                              overview.availability.isOrderAheadEnabled ? 'Activo' : 'Inactivo'
                            }
                            tone={getStatusTone(
                              overview.availability.isOrderAheadEnabled ? 'active' : 'inactive',
                            )}
                          />
                          {!overview.availability.isOrderAheadEnabled &&
                          overview.availability.disabledReasonCode ? (
                            <StatusChip
                              label={overview.availability.disabledReasonCode}
                              tone="muted"
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="meta-block">
                        <span className="row-label">Última actualización</span>
                        <strong>{formatDateTime(overview.availability.updatedAt)}</strong>
                      </div>
                    </div>
                    {!overview.availability.isOrderAheadEnabled &&
                    overview.availability.disabledComment ? (
                      <p>{overview.availability.disabledComment}</p>
                    ) : null}
                  </div>

                  <form onSubmit={onSubmitOrderAhead} className="form-grid">
                    <label className="toggle-row surface-soft" htmlFor="order-ahead-enabled">
                      <input
                        id="order-ahead-enabled"
                        type="checkbox"
                        checked={newIsEnabled}
                        onChange={(event) => setNewIsEnabled(event.target.checked)}
                      />
                      <div className="stack" style={{ gap: '0.2rem' }}>
                        <strong>Habilitar order-ahead</strong>
                        <span className="field-help">
                          Si se desactiva, el motivo y comentario quedan visibles para dar contexto
                          operativo.
                        </span>
                      </div>
                    </label>

                    {!newIsEnabled ? (
                      <div className="form-grid form-grid--two">
                        <label className="field">
                          <span className="field-label">Motivo de pausa</span>
                          <select
                            value={reasonCode}
                            onChange={(event) => setReasonCode(event.target.value)}
                          >
                            <option value="manual_pause">Manual pause</option>
                            <option value="equipment_issue">Equipment issue</option>
                            <option value="staffing_issue">Staffing issue</option>
                            <option value="inventory_issue">Inventory issue</option>
                            <option value="system_issue">System issue</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">Comentario interno/visible</span>
                          <textarea
                            value={comment}
                            onChange={(event) => setComment(event.target.value)}
                          />
                        </label>
                      </div>
                    ) : null}

                    <div className="inline-actions">
                      <button
                        className="button button--primary"
                        type="submit"
                        disabled={overviewSaving}
                      >
                        {overviewSaving ? 'Guardando…' : 'Guardar estado operativo'}
                      </button>
                      <span className="field-help">
                        Evita cambios accidentales revisando motivo y comentario antes de pausar.
                      </span>
                    </div>
                  </form>

                  <div className="stack">
                    <h3>Historial reciente</h3>
                    {overview.recentHistory.length === 0 ? (
                      <EmptyState
                        title="Sin cambios recientes"
                        description="Cuando la disponibilidad cambie, el historial mostrará actor, estado y fecha para auditoría rápida."
                      />
                    ) : (
                      <div className="list-grid">
                        {overview.recentHistory.map((event) => (
                          <div key={event.id} className="transaction-row">
                            <div className="stack" style={{ gap: '0.35rem' }}>
                              <div className="chip-row">
                                <StatusChip
                                  label={event.newIsEnabled ? 'Activo' : 'Pausado'}
                                  tone={event.newIsEnabled ? 'success' : 'danger'}
                                />
                                {event.reasonCode ? (
                                  <StatusChip label={event.reasonCode} tone="muted" />
                                ) : null}
                              </div>
                              <strong>{formatDateTime(event.changedAt)}</strong>
                              <span className="meta-text">{event.changedByRole}</span>
                            </div>
                            <div className="stack" style={{ gap: '0.35rem', maxWidth: 360 }}>
                              <span className="row-label">Comentario</span>
                              <span>{event.comment || 'Sin comentario adicional.'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="Sin overview disponible"
                  description="No fue posible cargar el estado actual de la sucursal."
                />
              )}
            </SectionCard>
          </div>

          <SectionCard>
            <CardHeader>
              <div className="stack">
                <h2>Órdenes de la sucursal</h2>
                <p>
                  Cada orden destaca estado actual, siguiente acción válida, montos y evidencias del
                  flujo.
                </p>
              </div>
              <div className="field card-header__control">
                <label className="field-label" htmlFor="order-filter">
                  Filtro por estado
                </label>
                <select
                  id="order-filter"
                  value={orderStatusFilter}
                  onChange={(event) =>
                    setOrderStatusFilter(event.target.value as OrderStatusFilter)
                  }
                >
                  <option value="all">Todas</option>
                  <option value="pending_acceptance">Pendientes</option>
                  <option value="accepted">Aceptadas</option>
                  <option value="rejected">Rechazadas</option>
                  <option value="cancelled_by_customer">Canceladas</option>
                  <option value="ready_for_pickup">Listas</option>
                  <option value="completed">Completadas</option>
                  <option value="no_show">No-show</option>
                </select>
              </div>
            </CardHeader>
            {ordersError ? <InlineFeedback tone="error" message={ordersError} /> : null}
            {orderFeedback ? <InlineFeedback tone="success" message={orderFeedback} /> : null}
            {storeWideIssuePromptVisible ? (
              <InlineFeedback
                tone="warning"
                message={`Order-ahead sigue activo y ya hay ${recentRejectedOrders} rechazos recientes en esta vista. Si la causa es general, pausa la sucursal antes de seguir rechazando pedidos.`}
              />
            ) : null}
            {ordersLoading ? (
              <LoadingBlock label="Cargando órdenes de la sucursal…" />
            ) : orders.length === 0 ? (
              <EmptyState
                title="No hay órdenes para esta vista"
                description="Prueba otro filtro o espera nuevas compras para ver actividad aquí."
              />
            ) : (
              <div className="list-grid">
                {orders.map((order) => {
                  const pendingAction = orderActionPending[order.id];
                  const latestNotification = order.notifications[0] ?? null;
                  const noShowReason =
                    order.status === 'no_show'
                      ? typeof order.lastEvent?.metadataJson?.reason === 'string'
                        ? order.lastEvent.metadataJson.reason
                        : null
                      : null;
                  const preventionMessages = getPendingAcceptancePreventionMessages({
                    isOrderAheadEnabled: overview?.availability.isOrderAheadEnabled === true,
                    repeatedRecentRejects: recentRejectedOrders,
                  });

                  return (
                    <article key={order.id} className="order-card compact-card">
                      <div className="order-card__header">
                        <div className="stack" style={{ gap: '0.4rem' }}>
                          <div className="chip-row">
                            <StatusChip
                              label={getAdminOrderStatusLabel(order.status)}
                              tone={getStatusTone(order.status)}
                            />
                            <StatusChip label={order.storeName} tone="muted" />
                          </div>
                          <strong>{formatClp(order.totalAmount)}</strong>
                          <span className="meta-text">Orden {order.id}</span>
                        </div>
                        <div className="stack" style={{ gap: '0.3rem', maxWidth: 320 }}>
                          <span className="row-label">Cliente</span>
                          <strong>{order.customerIdentifier}</strong>
                          <span className="field-help">{getNextActionHint(order.status)}</span>
                        </div>
                      </div>

                      <div className="order-card__metrics">
                        <div className="meta-block">
                          <span className="row-label">Creada</span>
                          <strong>{formatDateTime(order.placedAt)}</strong>
                        </div>
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
                      </div>

                      <div className="surface-soft stack">
                        <div className="order-items">
                          {order.items.map((item) => (
                            <div key={item.id} className="order-item-row">
                              <span>{item.itemNameSnapshot}</span>
                              <strong>x{item.quantity}</strong>
                            </div>
                          ))}
                        </div>
                        {order.lastEvent ? (
                          <div className="meta-text">
                            Último evento: {order.lastEvent.eventType} ·{' '}
                            {formatDateTime(order.lastEvent.createdAt)}
                            {order.lastEvent.actorRole ? ` · ${order.lastEvent.actorRole}` : ''}
                          </div>
                        ) : null}
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
                        {noShowReason ? (
                          <InlineFeedback
                            tone="warning"
                            message={`Nota no-show: ${noShowReason}`}
                          />
                        ) : null}
                        {latestNotification ? (
                          <div className="surface-soft stack" style={{ gap: '0.6rem' }}>
                            <div className="toolbar">
                              <div className="stack" style={{ gap: '0.25rem' }}>
                                <span className="row-label">
                                  Última consecuencia de notificación
                                </span>
                                <div className="chip-row">
                                  <StatusChip
                                    label={getAdminNotificationTypeLabel(
                                      latestNotification.notificationType,
                                    )}
                                    tone="muted"
                                  />
                                  <StatusChip
                                    label={getAdminNotificationStatusLabel(
                                      latestNotification.status,
                                    )}
                                    tone={getNotificationStatusTone(latestNotification.status)}
                                  />
                                  <StatusChip
                                    label={`Intentos ${latestNotification.attemptCount}`}
                                    tone="muted"
                                  />
                                </div>
                              </div>
                              {latestNotification.status === 'failed' ? (
                                <button
                                  className="button button--secondary"
                                  type="button"
                                  onClick={() =>
                                    onRetryNotification(order.id, latestNotification.id)
                                  }
                                  disabled={
                                    orderActionPending[latestNotification.id] ===
                                    'retry-notification'
                                  }
                                >
                                  {orderActionPending[latestNotification.id] ===
                                  'retry-notification'
                                    ? 'Reintentando…'
                                    : 'Reintentar notificación'}
                                </button>
                              ) : null}
                            </div>
                            <div className="order-card__metrics">
                              <div className="meta-block">
                                <span className="row-label">Creada</span>
                                <strong>{formatDateTime(latestNotification.createdAt)}</strong>
                              </div>
                              <div className="meta-block">
                                <span className="row-label">Última actualización</span>
                                <strong>{formatDateTime(latestNotification.updatedAt)}</strong>
                              </div>
                              <div className="meta-block">
                                <span className="row-label">Canal</span>
                                <strong>{latestNotification.channel}</strong>
                              </div>
                            </div>
                            {latestNotification.failureReason ? (
                              <InlineFeedback
                                tone="error"
                                message={`Último error: ${latestNotification.failureReason}`}
                              />
                            ) : null}
                          </div>
                        ) : (
                          <InlineFeedback
                            tone="info"
                            message="Esta orden aún no generó una notificación operacional interna."
                          />
                        )}
                      </div>

                      <div className="stack">
                        {order.status === 'pending_acceptance' ? (
                          <div className="stack compact-card">
                            <div className="surface-soft stack order-prevention-panel">
                              <div className="toolbar">
                                <div className="stack" style={{ gap: '0.3rem' }}>
                                  <span className="kicker">Antes de rechazar</span>
                                  <strong>
                                    El rechazo debe ser la excepción, no la ruta normal.
                                  </strong>
                                  <span className="field-help">
                                    Elige primero la acción al nivel correcto para evitar rechazos
                                    prevenibles.
                                  </span>
                                </div>
                                <button
                                  className="button button--primary"
                                  type="button"
                                  onClick={() => onOrderAction(order.id, 'accept')}
                                  disabled={Boolean(pendingAction)}
                                >
                                  {pendingAction === 'accept' ? 'Aceptando…' : 'Aceptar orden'}
                                </button>
                              </div>
                              <ul className="admin-guidance-list">
                                {preventionMessages.map((message) => (
                                  <li key={`${order.id}-${message}`}>{message}</li>
                                ))}
                              </ul>
                              <div className="inline-actions inline-actions--tight">
                                <button
                                  className="button button--secondary"
                                  type="button"
                                  onClick={() =>
                                    prefillPause(
                                      'inventory_issue',
                                      `Pausa preventiva iniciada desde orden ${order.id} por rechazo repetido o causa transversal.`,
                                    )
                                  }
                                  disabled={Boolean(pendingAction)}
                                >
                                  Pausar order-ahead
                                </button>
                                <button
                                  className="button button--ghost"
                                  type="button"
                                  onClick={jumpToMenuStock}
                                  disabled={Boolean(pendingAction)}
                                >
                                  Revisar stock del menú
                                </button>
                              </div>
                            </div>

                            <div className="form-grid form-row--inline compact-card order-exception-row">
                              <label className="field">
                                <span className="field-label">Motivo obligatorio de rechazo</span>
                                <input
                                  placeholder="Documenta por qué esta orden sí requiere excepción"
                                  value={rejectReasons[order.id] ?? ''}
                                  onChange={(event) =>
                                    setRejectReasons((current) => ({
                                      ...current,
                                      [order.id]: event.target.value,
                                    }))
                                  }
                                  disabled={Boolean(pendingAction)}
                                />
                                <span className="field-help">
                                  Usa rechazo sólo cuando no alcance con aceptar, pausar order-ahead
                                  o ajustar stock.
                                </span>
                              </label>
                              <button
                                className="button button--ghost order-exception-button"
                                type="button"
                                onClick={() => onRejectOrder(order.id)}
                                disabled={Boolean(pendingAction)}
                              >
                                {pendingAction === 'reject'
                                  ? 'Rechazando…'
                                  : 'Rechazar como excepción'}
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {order.status === 'accepted' ? (
                          <div className="form-grid form-row--inline compact-card">
                            <button
                              className="button button--primary"
                              type="button"
                              onClick={() => onOrderAction(order.id, 'ready')}
                              disabled={Boolean(pendingAction)}
                            >
                              {pendingAction === 'ready' ? 'Actualizando…' : 'Marcar lista'}
                            </button>
                            <label className="field">
                              <span className="field-label">Nota de no-show</span>
                              <input
                                placeholder="Registra contexto si no retira"
                                value={noShowReasons[order.id] ?? ''}
                                onChange={(event) =>
                                  setNoShowReasons((current) => ({
                                    ...current,
                                    [order.id]: event.target.value,
                                  }))
                                }
                                disabled={Boolean(pendingAction)}
                              />
                            </label>
                            <button
                              className="button button--soft-danger"
                              type="button"
                              onClick={() => onNoShowOrder(order.id)}
                              disabled={Boolean(pendingAction)}
                            >
                              {pendingAction === 'no-show' ? 'Registrando…' : 'Marcar no-show'}
                            </button>
                          </div>
                        ) : null}

                        {order.status === 'ready_for_pickup' ? (
                          <div className="form-grid form-row--inline compact-card">
                            <button
                              className="button button--primary"
                              type="button"
                              onClick={() => onOrderAction(order.id, 'complete')}
                              disabled={Boolean(pendingAction)}
                            >
                              {pendingAction === 'complete' ? 'Completando…' : 'Completar entrega'}
                            </button>
                            <label className="field">
                              <span className="field-label">Nota de no-show</span>
                              <input
                                placeholder="Usa esta nota si el cliente no se presenta"
                                value={noShowReasons[order.id] ?? ''}
                                onChange={(event) =>
                                  setNoShowReasons((current) => ({
                                    ...current,
                                    [order.id]: event.target.value,
                                  }))
                                }
                                disabled={Boolean(pendingAction)}
                              />
                            </label>
                            <button
                              className="button button--soft-danger"
                              type="button"
                              onClick={() => onNoShowOrder(order.id)}
                              disabled={Boolean(pendingAction)}
                            >
                              {pendingAction === 'no-show' ? 'Registrando…' : 'Marcar no-show'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <div id="admin-menu">
            <SectionCard>
              <CardHeader>
                <div className="stack">
                  <h2>Menú</h2>
                  <p>
                    Configura productos con bloques más claros para creación, attach y visibilidad
                    por sucursal.
                  </p>
                </div>
              </CardHeader>
              {menuError ? <InlineFeedback tone="error" message={menuError} /> : null}
              {menuLoading ? (
                <LoadingBlock label="Cargando configuración del menú…" />
              ) : (
                <>
                  <div className="stack compact-list">
                    <InlineFeedback
                      tone="info"
                      message="Flujo único del menú: primero crea el producto base, luego adjúntalo a la sucursal activa y finalmente revisa la configuración visible."
                    />
                    <div className="menu-config-grid">
                      <form
                        onSubmit={onCreateBaseItem}
                        className="section-card compact-card"
                        style={{ padding: '1.1rem' }}
                      >
                        <div className="stack">
                          <h3>Crear producto base</h3>
                          <p className="helper-text">
                            Define el producto reusable una sola vez antes de asignarlo a
                            sucursales.
                          </p>
                        </div>
                        <label className="field">
                          <span className="field-label">Code</span>
                          <input
                            value={createCode}
                            onChange={(event) => setCreateCode(event.target.value)}
                            placeholder="latte_12oz"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Nombre</span>
                          <input
                            value={createName}
                            onChange={(event) => setCreateName(event.target.value)}
                            placeholder="Latte"
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Descripción</span>
                          <textarea
                            value={createDescription}
                            onChange={(event) => setCreateDescription(event.target.value)}
                            placeholder="Notas breves para equipo y cliente"
                          />
                        </label>
                        <button
                          className="button button--primary"
                          type="submit"
                          disabled={menuActionLoading === 'create'}
                        >
                          {menuActionLoading === 'create' ? 'Creando…' : 'Crear producto'}
                        </button>
                      </form>

                      <form
                        onSubmit={onAttachItem}
                        className="section-card compact-card"
                        style={{ padding: '1.1rem' }}
                      >
                        <div className="stack">
                          <h3>Adjuntar a sucursal</h3>
                          <p className="helper-text">
                            Convierte un producto base en una opción vendible dentro de la tienda
                            activa.
                          </p>
                        </div>
                        <label className="field">
                          <span className="field-label">Producto base</span>
                          <select
                            value={attachMenuItemId}
                            onChange={(event) => setAttachMenuItemId(event.target.value)}
                          >
                            {menuOverview?.availableBaseItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">Precio CLP</span>
                          <input
                            type="number"
                            min={1}
                            value={attachPriceAmount}
                            onChange={(event) => setAttachPriceAmount(event.target.value)}
                          />
                        </label>
                        <button
                          className="button button--primary"
                          type="submit"
                          disabled={menuActionLoading === 'attach'}
                        >
                          {menuActionLoading === 'attach' ? 'Adjuntando…' : 'Adjuntar producto'}
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="stack compact-list">
                    <h3>Configuración actual</h3>
                    {menuOverview?.configuredItems.length ? (
                      <div className="list-grid compact-list">
                        {menuOverview.configuredItems.map((item) => {
                          const pending = menuActionLoading === item.menuItemId;
                          return (
                            <article
                              key={item.storeMenuItemId}
                              className="menu-item-card compact-card"
                            >
                              <div className="menu-item-card__header">
                                <div className="stack" style={{ gap: '0.35rem' }}>
                                  <strong>{item.name}</strong>
                                  <span className="meta-text">{item.code}</span>
                                  {item.description ? (
                                    <span className="meta-text">{item.description}</span>
                                  ) : null}
                                </div>
                                <div
                                  className="stack"
                                  style={{ gap: '0.35rem', alignItems: 'flex-end' }}
                                >
                                  <strong>{formatClp(item.priceAmount)}</strong>
                                  <div className="chip-row">
                                    <StatusChip
                                      label={item.isVisible ? 'Activo' : 'Oculto'}
                                      tone={item.isVisible ? 'success' : 'muted'}
                                    />
                                    <StatusChip
                                      label={item.isInStock ? 'En stock' : 'Sin stock'}
                                      tone={item.isInStock ? 'info' : 'warning'}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="inline-actions inline-actions--tight">
                                <button
                                  className="button button--secondary"
                                  type="button"
                                  onClick={() =>
                                    onUpdateStoreItem(item.menuItemId, {
                                      priceAmount: item.priceAmount,
                                      isVisible: !item.isVisible,
                                      isInStock: item.isInStock,
                                      sortOrder: item.sortOrder,
                                    })
                                  }
                                  disabled={pending}
                                >
                                  {pending
                                    ? 'Actualizando…'
                                    : item.isVisible
                                      ? 'Ocultar producto'
                                      : 'Mostrar producto'}
                                </button>
                                <button
                                  className="button button--ghost"
                                  type="button"
                                  onClick={() =>
                                    onUpdateStoreItem(item.menuItemId, {
                                      priceAmount: item.priceAmount,
                                      isVisible: item.isVisible,
                                      isInStock: !item.isInStock,
                                      sortOrder: item.sortOrder,
                                    })
                                  }
                                  disabled={pending}
                                >
                                  {item.isInStock ? 'Marcar sin stock' : 'Marcar con stock'}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState
                        title="Sin productos configurados"
                        description="Primero crea o adjunta un producto para que esta sucursal pueda venderlo."
                      />
                    )}
                  </div>
                </>
              )}
            </SectionCard>
          </div>
        </div>

        <div className="stack">
          <SectionCard>
            <CardHeader>
              <div className="stack">
                <h2>Wallet prepaga</h2>
                <p>
                  Cash top-up y ajustes con lenguaje compartido, mejor separación y estados
                  visibles.
                </p>
              </div>
            </CardHeader>
            <div className="surface-soft stack">
              <p>
                Customer key demo sugerida: <code>demo-wallet-customer</code>
              </p>
              <form onSubmit={onLookupWallet} className="form-row form-row--inline">
                <label className="field">
                  <span className="field-label">Customer key</span>
                  <input
                    aria-label="Customer key"
                    value={walletCustomerKey}
                    onChange={(event) => setWalletCustomerKey(event.target.value)}
                    placeholder="customer key"
                  />
                </label>
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={walletLookupPending}
                >
                  {walletLookupPending ? 'Buscando…' : 'Buscar wallet'}
                </button>
              </form>
            </div>

            {walletError ? <InlineFeedback tone="error" message={walletError} /> : null}
            {walletLoading ? <LoadingBlock label="Cargando wallet y movimientos…" /> : null}
            {walletSummary ? (
              <>
                <StatGrid>
                  <StatItem label="Wallet" value={walletSummary.wallet.customerIdentifier} />
                  <StatItem
                    label="Balance actual"
                    value={formatClp(walletSummary.currentBalance)}
                  />
                  <StatItem label="Moneda" value={walletSummary.wallet.currencyCode} />
                </StatGrid>

                <div className="wallet-layout">
                  <div className="section-card compact-card" style={{ padding: '1rem' }}>
                    <div className="stack">
                      <h3>Top-up por caja</h3>
                      <p className="helper-text">
                        Acción primaria para una carga inmediata validada por backend según rol.
                      </p>
                    </div>
                    <form onSubmit={onCashTopup} className="form-grid form-grid--two compact-card">
                      <label className="field">
                        <span className="field-label">Monto</span>
                        <input
                          type="number"
                          min={1}
                          value={cashTopupAmount}
                          onChange={(event) => setCashTopupAmount(event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">Nota</span>
                        <input
                          value={cashTopupNote}
                          onChange={(event) => setCashTopupNote(event.target.value)}
                          placeholder="Detalle para caja"
                        />
                      </label>
                      <button
                        className="button button--primary button--block"
                        type="submit"
                        disabled={cashTopupPending}
                      >
                        {cashTopupPending ? 'Registrando…' : 'Registrar carga inmediata'}
                      </button>
                    </form>
                  </div>

                  <div className="section-card compact-card" style={{ padding: '1rem' }}>
                    <div className="stack">
                      <h3>Ajuste admin</h3>
                      <p className="helper-text">
                        Acción sensible con motivo obligatorio para dejar trazabilidad operativa.
                      </p>
                    </div>
                    <form onSubmit={onAdjustment} className="form-grid form-grid--two compact-card">
                      <label className="field">
                        <span className="field-label">Dirección</span>
                        <select
                          value={adjustmentDirection}
                          onChange={(event) =>
                            setAdjustmentDirection(event.target.value as 'credit' | 'debit')
                          }
                        >
                          <option value="credit">Crédito</option>
                          <option value="debit">Débito</option>
                        </select>
                      </label>
                      <label className="field">
                        <span className="field-label">Monto</span>
                        <input
                          type="number"
                          min={1}
                          value={adjustmentAmount}
                          onChange={(event) => setAdjustmentAmount(event.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">Motivo</span>
                        <textarea
                          value={adjustmentNote}
                          onChange={(event) => setAdjustmentNote(event.target.value)}
                          placeholder="Motivo obligatorio"
                        />
                      </label>
                      <button
                        className="button button--danger button--block"
                        type="submit"
                        disabled={adjustmentPending}
                      >
                        {adjustmentPending ? 'Registrando…' : 'Registrar ajuste'}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="stack compact-list">
                  <h3>Transacciones</h3>
                  {walletTransactions.length === 0 ? (
                    <EmptyState
                      title="Sin movimientos todavía"
                      description="Cuando existan top-ups, órdenes o ajustes, aparecerán aquí con actor, referencia y nota."
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
                            <span className="meta-text">
                              {formatDateTime(transaction.createdAt)}
                            </span>
                          </div>
                          <div className="stack" style={{ gap: '0.35rem', maxWidth: 320 }}>
                            <span className="meta-text">
                              Actor: {transaction.createdByRole ?? 'n/a'} · Ref:{' '}
                              {transaction.referenceType ?? 'n/a'} {transaction.referenceId ?? '—'}
                            </span>
                            {transaction.note ? <span>{transaction.note}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              !walletLoading && (
                <EmptyState
                  title="Busca una wallet para operar"
                  description="Ingresa una customer key para revisar balance, cargar saldo o aplicar ajustes."
                />
              )
            )}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
