'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppShell,
  CardHeader,
  EmptyState,
  InlineFeedback,
  LoadingBlock,
  SectionCard,
  StatGrid,
  StatItem,
  StatusChip,
  SummaryCard,
} from '@/components/ui/dashboard';

type StoreCode = 'store_1';

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

type AuthState = {
  authenticated: boolean;
  customer: {
    id: string;
    phoneNumber: string;
  } | null;
  walletSummary: WalletSummary | null;
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

function maskPhoneNumber(phoneNumber: string) {
  if (phoneNumber.length <= 4) {
    return phoneNumber;
  }

  return `${phoneNumber.slice(0, 4)} ••• ${phoneNumber.slice(-3)}`;
}

function getCalmErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'string') {
    return fallback;
  }

  const normalizedError = error.trim();
  if (!normalizedError) {
    return fallback;
  }

  const loweredError = normalizedError.toLowerCase();
  if (
    loweredError.includes('unexpected error') ||
    loweredError.includes('internal server error') ||
    loweredError.includes('failed to fetch') ||
    loweredError.includes('network') ||
    loweredError.includes('fetch failed')
  ) {
    return fallback;
  }

  return normalizedError;
}

function getPayloadErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const { error } = payload as { error?: unknown };
  return typeof error === 'string' ? error : null;
}

function getCustomerOrderErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'string') {
    return fallback;
  }

  const normalizedError = error.trim();
  if (!normalizedError) {
    return fallback;
  }

  const loweredError = normalizedError.toLowerCase();

  if (loweredError.includes('inicia sesión con tu teléfono')) {
    return 'Ingresa con tu teléfono para confirmar el pedido.';
  }

  if (
    loweredError.includes('order-ahead is currently unavailable') ||
    (loweredError.includes('store') && loweredError.includes('was not found'))
  ) {
    return 'La tienda no puede recibir pedidos ahora. Intenta de nuevo en unos minutos.';
  }

  if (loweredError.includes('menu item') && loweredError.includes('unavailable')) {
    return 'Uno o más productos ya no están disponibles. Revisa tu pedido e intenta de nuevo.';
  }

  if (
    loweredError.includes('insufficient funds') ||
    loweredError.includes('insufficient wallet balance')
  ) {
    return 'No pudimos confirmar el pago de tu pedido. Revisa tu saldo e intenta de nuevo.';
  }

  if (
    loweredError.includes('must include at least one item') ||
    loweredError.includes('quantities must be positive integers') ||
    loweredError.includes('order total must be a positive integer')
  ) {
    return 'Revisa tu pedido e intenta de nuevo.';
  }

  return getCalmErrorMessage(normalizedError, fallback);
}

function getCustomerCancelErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'string') {
    return fallback;
  }

  const normalizedError = error.trim();
  if (!normalizedError) {
    return fallback;
  }

  const loweredError = normalizedError.toLowerCase();

  if (loweredError.includes('inicia sesión con tu teléfono')) {
    return 'Vuelve a ingresar con tu teléfono para revisar este pedido.';
  }

  if (loweredError.includes('cancellation window has expired')) {
    return 'Ya no alcanzas a cancelar este pedido desde aquí.';
  }

  if (loweredError.includes('cannot move order from')) {
    return 'Este pedido ya cambió de estado. Actualiza la vista para seguirlo.';
  }

  if (loweredError.includes('order was not found')) {
    return 'No encontramos ese pedido. Actualiza la vista e intenta de nuevo.';
  }

  return getCalmErrorMessage(normalizedError, fallback);
}

async function readJsonPayload(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
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
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const [otpRequestedPhone, setOtpRequestedPhone] = useState<string | null>(null);
  const [phoneNumberInput, setPhoneNumberInput] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderActionError, setOrderActionError] = useState<string | null>(null);
  const [orderActionFeedback, setOrderActionFeedback] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const isAuthenticated = authState?.authenticated === true && !!authState.customer;
  const currentBalance = authState?.walletSummary?.currentBalance ?? 0;

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
        setError(
          getCalmErrorMessage(
            availabilityPayload.error,
            'La tienda no respondió. Vuelve a intentarlo en un momento.',
          ),
        );
        setStoreLoading(false);
        return;
      }

      if (!menuResponse.ok) {
        setAvailability(availabilityPayload.availability as Availability);
        setMenu(null);
        setError(
          getCalmErrorMessage(menuPayload.error, 'No pudimos cargar el menú. Intenta de nuevo.'),
        );
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

  const loadAuthState = useCallback(async () => {
    setAuthLoading(true);

    try {
      const response = await fetch('/api/customer-auth/session', { cache: 'no-store' });
      const payload = (await response.json()) as AuthState & { error?: string };

      if (!response.ok) {
        setAuthState({ authenticated: false, customer: null, walletSummary: null });
        setAuthError(getCalmErrorMessage(payload.error, 'No pudimos revisar tu sesión.'));
        return;
      }

      setAuthState({
        authenticated: payload.authenticated,
        customer: payload.customer,
        walletSummary: payload.walletSummary,
      });
      setAuthError(null);
      if (!payload.authenticated) {
        setOrders([]);
        setOrdersError(null);
      }
    } catch {
      setAuthState({ authenticated: false, customer: null, walletSummary: null });
      setAuthError('No pudimos revisar tu sesión.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([]);
      setOrdersError(null);
      setOrdersLoading(false);
      return;
    }

    setOrdersLoading(true);

    try {
      const response = await fetch('/api/customers/me/orders', {
        cache: 'no-store',
      });
      const payload = (await response.json()) as { orders?: Order[]; error?: string };

      if (!response.ok) {
        setOrders([]);
        setOrdersError(
          getCalmErrorMessage(payload.error, 'No pudimos revisar el estado de tu pedido.'),
        );
        return;
      }

      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      setOrdersError(null);
    } catch {
      setOrders([]);
      setOrdersError('No pudimos revisar el estado de tu pedido.');
    } finally {
      setOrdersLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadAuthState();
  }, [loadAuthState]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOrders([]);
      setOrdersError(null);
      return;
    }

    void loadOrders();

    const intervalId = window.setInterval(() => {
      void loadOrders();
    }, ORDER_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, loadOrders]);

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
  const orderTotalExceedsBalance = orderTotal > currentBalance;

  const sortedOrders = useMemo(
    () => [...orders].sort((left, right) => +new Date(right.placedAt) - +new Date(left.placedAt)),
    [orders],
  );

  const featuredOrder = useMemo(
    () =>
      sortedOrders.find((order) =>
        ['pending_acceptance', 'accepted', 'ready_for_pickup'].includes(order.status),
      ) ??
      sortedOrders[0] ??
      null,
    [sortedOrders],
  );

  const recentOrders = useMemo(
    () => sortedOrders.filter((order) => order.id !== featuredOrder?.id).slice(0, 3),
    [featuredOrder?.id, sortedOrders],
  );

  async function onRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestingOtp(true);
    setAuthError(null);
    setAuthFeedback(null);

    try {
      const response = await fetch('/api/customer-auth/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: phoneNumberInput }),
      });
      const payload = await readJsonPayload(response);

      if (!response.ok) {
        setAuthError(
          getCalmErrorMessage(
            getPayloadErrorMessage(payload),
            'No pudimos enviar el código. Intenta de nuevo.',
          ),
        );
        return;
      }

      const nextPhone =
        payload && typeof payload === 'object' && 'phoneNumber' in payload
          ? String(payload.phoneNumber)
          : phoneNumberInput;

      setOtpRequestedPhone(nextPhone);
      setPhoneNumberInput(nextPhone);
      setAuthFeedback('Te enviamos un código por SMS.');
    } catch {
      setAuthError('No pudimos enviar el código. Intenta de nuevo.');
    } finally {
      setRequestingOtp(false);
    }
  }

  async function onVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyingOtp(true);
    setAuthError(null);
    setAuthFeedback(null);

    try {
      const response = await fetch('/api/customer-auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: otpRequestedPhone ?? phoneNumberInput,
          code: otpCodeInput,
        }),
      });
      const payload = await readJsonPayload(response);

      if (!response.ok) {
        setAuthError(
          getCalmErrorMessage(
            getPayloadErrorMessage(payload),
            'No pudimos confirmar el código. Intenta de nuevo.',
          ),
        );
        return;
      }

      setOtpCodeInput('');
      setOtpRequestedPhone(null);
      setAuthFeedback('Tu sesión ya está lista.');
      await loadAuthState();
      await loadOrders();
    } catch {
      setAuthError('No pudimos confirmar el código. Intenta de nuevo.');
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function onSignOut() {
    setSigningOut(true);
    setAuthError(null);
    setAuthFeedback(null);

    try {
      const response = await fetch('/api/customer-auth/logout', { method: 'POST' });
      if (!response.ok) {
        const payload = await readJsonPayload(response);
        setAuthError(
          getCalmErrorMessage(
            getPayloadErrorMessage(payload),
            'No pudimos cerrar la sesión. Intenta de nuevo.',
          ),
        );
        return;
      }

      setAuthState({ authenticated: false, customer: null, walletSummary: null });
      setOrders([]);
      setOtpCodeInput('');
      setOtpRequestedPhone(null);
      setAuthFeedback('Sesión cerrada.');
    } catch {
      setAuthError('No pudimos cerrar la sesión. Intenta de nuevo.');
    } finally {
      setSigningOut(false);
    }
  }

  async function onPlaceOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOrderActionError(null);
    setOrderActionFeedback(null);
    setPlacingOrder(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeCode,
          items: selectedItems.map(({ item, quantity }) => ({
            menuItemId: item.menuItemId,
            quantity,
          })),
        }),
      });
      const payload = await readJsonPayload(response);

      if (!response.ok) {
        setOrderActionError(
          getCustomerOrderErrorMessage(
            getPayloadErrorMessage(payload),
            'No pudimos confirmar tu pedido. Intenta de nuevo.',
          ),
        );
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
      await Promise.all([loadAuthState(), loadOrders()]);
    } catch {
      setOrderActionError('No pudimos confirmar tu pedido. Intenta de nuevo.');
    } finally {
      setPlacingOrder(false);
    }
  }

  async function onCancelOrder(orderId: string) {
    setCancellingOrderId(orderId);
    setOrderActionError(null);
    setOrderActionFeedback(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Cancelado desde la vista cliente.' }),
      });
      const payload = await readJsonPayload(response);

      if (!response.ok) {
        setOrderActionError(
          getCustomerCancelErrorMessage(
            getPayloadErrorMessage(payload),
            'No pudimos cancelar tu pedido. Intenta de nuevo.',
          ),
        );
        return;
      }

      setOrderActionFeedback(
        payload &&
          typeof payload === 'object' &&
          'transitionApplied' in payload &&
          payload.transitionApplied === false
          ? 'Actualizamos el estado más reciente de tu pedido.'
          : 'Pedido cancelado correctamente.',
      );
      await Promise.all([loadAuthState(), loadOrders()]);
    } catch {
      setOrderActionError('No pudimos cancelar tu pedido. Intenta de nuevo.');
    } finally {
      setCancellingOrderId(null);
    }
  }

  return (
    <AppShell>
      <SummaryCard>
        <div className="summary-card__title-row">
          <div className="stack">
            <span className="summary-card__eyebrow">Order ahead</span>
            <h1>{availability?.storeName ?? 'Tu tienda'}</h1>
            <p>{getAvailabilityMessage(availability)}</p>
          </div>
          <div className="stack" style={{ gap: '0.75rem', alignItems: 'flex-end' }}>
            <StatusChip
              label={availability?.isOrderAheadEnabled ? 'Disponible' : 'No disponible'}
              tone={getStatusTone(availability?.isOrderAheadEnabled ? 'available' : 'unavailable')}
            />
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
        </div>
        <StatGrid>
          <StatItem
            label="Tienda"
            value={availability?.storeName ?? storeCode}
            helper={
              availability
                ? `Actualizado ${formatDateTime(availability.updatedAt)}`
                : 'Revisando disponibilidad'
            }
          />
          <StatItem
            label="Estado"
            value={availability?.isOrderAheadEnabled ? 'Puedes pedir ahora' : 'No disponible ahora'}
            helper={
              availability?.isOrderAheadEnabled
                ? 'Haz tu pedido y pasa a retirar.'
                : 'Vuelve a intentar en unos minutos.'
            }
          />
          <StatItem
            label="Saldo"
            value={isAuthenticated ? formatClp(currentBalance) : 'Ingresa para verlo'}
            helper={
              isAuthenticated
                ? 'Tu saldo disponible para este pedido.'
                : 'Lo verás aquí después de ingresar.'
            }
          />
          <StatItem
            label="Sesión"
            value={isAuthenticated ? maskPhoneNumber(authState?.customer?.phoneNumber ?? '') : 'Pendiente'}
            helper={isAuthenticated ? 'Lista para pedir y seguir tu orden.' : 'Ingresa con tu teléfono.'}
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

      <SectionCard className="section-card--order-focus">
        <CardHeader>
          <div className="stack">
            <span className="summary-card__eyebrow">1. Ingresa con tu teléfono</span>
            <h2>Tu acceso</h2>
            <p>Usamos un código por SMS para que puedas pedir y seguir tu orden sin vueltas.</p>
          </div>
          <StatusChip
            label={isAuthenticated ? 'Sesión lista' : authLoading ? 'Revisando' : 'Falta ingresar'}
            tone={isAuthenticated ? 'success' : authLoading ? 'neutral' : 'warning'}
          />
        </CardHeader>
        {authError ? <InlineFeedback tone="error" message={authError} /> : null}
        {authFeedback ? <InlineFeedback tone="success" message={authFeedback} /> : null}
        {authLoading ? (
          <LoadingBlock label="Revisando tu sesión…" />
        ) : isAuthenticated ? (
          <div className="surface-soft stack compact-card">
            <div className="toolbar transaction-meta">
              <div className="stack" style={{ gap: '0.3rem' }}>
                <strong>{maskPhoneNumber(authState?.customer?.phoneNumber ?? '')}</strong>
                <span className="meta-text">Tu saldo disponible es {formatClp(currentBalance)}.</span>
              </div>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void onSignOut()}
                disabled={signingOut}
              >
                {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
              </button>
            </div>
            <span className="field-help">
              Si necesitas recargar, el equipo puede hacerlo en caja cuando estés en tienda.
            </span>
          </div>
        ) : otpRequestedPhone ? (
          <form onSubmit={onVerifyOtp} className="stack">
            <div className="field-grid two-up">
              <div className="field">
                <label className="field-label" htmlFor="auth-phone-confirmed">
                  Teléfono
                </label>
                <input id="auth-phone-confirmed" value={otpRequestedPhone} disabled />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="auth-code">
                  Código SMS
                </label>
                <input
                  id="auth-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={otpCodeInput}
                  onChange={(event) => setOtpCodeInput(event.target.value)}
                />
              </div>
            </div>
            <div className="toolbar transaction-meta">
              <button className="button button--primary" type="submit" disabled={verifyingOtp}>
                {verifyingOtp ? 'Confirmando…' : 'Confirmar código'}
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => {
                  setOtpRequestedPhone(null);
                  setOtpCodeInput('');
                  setAuthFeedback(null);
                }}
              >
                Cambiar teléfono
              </button>
            </div>
            <span className="field-help">El código vence pronto. Si no llegó, pide uno nuevo.</span>
          </form>
        ) : (
          <form onSubmit={onRequestOtp} className="stack">
            <div className="field">
              <label className="field-label" htmlFor="auth-phone">
                Teléfono
              </label>
              <input
                id="auth-phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+56912345678"
                value={phoneNumberInput}
                onChange={(event) => setPhoneNumberInput(event.target.value)}
              />
              <span className="field-help">Usa tu número con código de país.</span>
            </div>
            <div className="toolbar transaction-meta">
              <button className="button button--primary" type="submit" disabled={requestingOtp}>
                {requestingOtp ? 'Enviando…' : 'Enviar código'}
              </button>
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard className="section-card--order-focus">
        <CardHeader>
          <div className="stack">
            <span className="summary-card__eyebrow">2. Elige y pide</span>
            <h2>Elige tu pedido</h2>
            <p>Agrega lo que quieras y confirma en segundos.</p>
          </div>
          {availability ? (
            <StatusChip
              label={availability.isOrderAheadEnabled ? 'Listo para pedir' : 'Pausa temporal'}
              tone={availability.isOrderAheadEnabled ? 'success' : 'warning'}
            />
          ) : null}
        </CardHeader>
        {orderActionError ? <InlineFeedback tone="error" message={orderActionError} /> : null}
        {orderActionFeedback ? (
          <InlineFeedback tone="success" message={orderActionFeedback} />
        ) : null}
        {!isAuthenticated ? (
          <EmptyState
            title="Primero ingresa con tu teléfono"
            description="Después podrás confirmar el pedido y ver su estado aquí mismo."
          />
        ) : storeLoading ? (
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
                  <article
                    key={item.storeMenuItemId}
                    className="menu-item-card compact-card menu-item-card--priority"
                  >
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
                          className="quantity-control__button quantity-control__button--secondary"
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
                          className="quantity-control__button quantity-control__button--primary"
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
                      {quantity > 0 ? (
                        <span className="meta-text">
                          Subtotal {formatClp(quantity * item.priceAmount)}
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="surface-soft stack compact-card">
              <div className="toolbar transaction-meta">
                <div className="stack" style={{ gap: '0.2rem' }}>
                  <span className="row-label">Total</span>
                  <strong style={{ fontSize: '2rem' }}>{formatClp(orderTotal)}</strong>
                </div>
                <div className="stack" style={{ gap: '0.2rem', alignItems: 'flex-end' }}>
                  <span className="row-label">Saldo disponible</span>
                  <strong>{formatClp(currentBalance)}</strong>
                </div>
              </div>
              {orderTotal > 0 ? (
                <span className="field-help">
                  {orderTotalExceedsBalance
                    ? 'Tu saldo no alcanza para este pedido. El equipo puede recargarlo en caja.'
                    : 'Tu saldo alcanza para confirmar este pedido.'}
                </span>
              ) : null}
              <button
                className="button button--primary button--block"
                type="submit"
                disabled={
                  selectedItems.length === 0 ||
                  placingOrder ||
                  !availability?.isOrderAheadEnabled ||
                  orderTotalExceedsBalance
                }
              >
                {placingOrder ? 'Enviando pedido…' : 'Pedir ahora'}
              </button>
              {!availability?.isOrderAheadEnabled ? (
                <span className="field-help">
                  La tienda debe estar disponible para confirmar tu pedido.
                </span>
              ) : null}
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard className={!featuredOrder ? 'section-card--compact' : undefined}>
        <CardHeader>
          <div className="stack">
            <span className="summary-card__eyebrow">3. Sigue tu pedido</span>
            <h2>Estado actual</h2>
            <p>
              {!isAuthenticated
                ? 'Cuando ingreses, verás aquí tus pedidos y su estado.'
                : featuredOrder
                  ? 'Revisa si ya fue recibido, está en preparación o listo para retiro.'
                  : 'Cuando hagas un pedido, verás su estado aquí.'}
            </p>
          </div>
          <StatusChip
            label={
              !isAuthenticated
                ? 'Ingresa para ver'
                : featuredOrder
                  ? getStatusLabel(featuredOrder.status)
                  : 'Sin pedido'
            }
            tone={getStatusTone(featuredOrder?.status ?? 'neutral')}
          />
        </CardHeader>
        {!isAuthenticated ? (
          <EmptyState
            title="Ingresa para seguir tu pedido"
            description="Usa tu teléfono y el código SMS para ver tus pedidos activos y recientes."
          />
        ) : ordersError ? (
          <InlineFeedback tone={featuredOrder ? 'error' : 'info'} message={ordersError} />
        ) : ordersLoading && orders.length === 0 ? (
          <LoadingBlock label="Buscando tu pedido actual…" />
        ) : !featuredOrder ? (
          <EmptyState
            title="Sin pedido activo"
            description="Cuando confirmes uno, verás aquí si fue recibido, está en preparación o listo para retiro."
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
                  <strong>
                    {featuredOrder.readyAt ? formatDateTime(featuredOrder.readyAt) : 'Aún no'}
                  </strong>
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
                  onClick={() => void onCancelOrder(featuredOrder.id)}
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
