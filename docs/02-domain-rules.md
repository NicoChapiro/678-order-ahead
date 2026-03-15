# Reglas de Dominio

## 1. Entidades principales
- **User**: actor autenticado (`owner`, `barista`, `customer`).
- **Store**: unidad operativa con configuración propia.
- **Order**: agregado transaccional de compra anticipada.
- **Wallet**: saldo prepago del cliente.
- **WalletTransaction**: movimiento inmutable (débito/crédito).
- **LoyaltyAccount**: saldo de puntos por cliente.
- **LoyaltyTransaction**: acumulación, canje o ajuste manual.
- **MenuItem / StoreMenuItem**: producto y su disponibilidad por tienda.

## 2. Invariantes globales
1. Todo pedido order-ahead pertenece a exactamente una tienda.
2. Todo pedido order-ahead se paga únicamente con wallet.
3. El saldo wallet nunca puede quedar negativo.
4. Cada movimiento wallet debe tener `reference_id` idempotente.
5. Toda transición de estado de orden debe quedar auditada.
6. Una orden no puede aceptarse si fue cancelada/rechazada/no-show.
7. El cliente sólo puede cancelar dentro de 5 minutos desde creación.

## 3. Reglas por rol
### Owner
- Puede administrar configuración de tienda, menú, precios, stock y horarios.
- Puede activar/desactivar order-ahead por tienda.
- Puede ajustar puntos manualmente.

### Barista
- Puede activar/desactivar order-ahead por tienda asignada.
- Puede aceptar/rechazar órdenes de su tienda.
- Puede marcar no-show según política operativa.

### Customer
- Puede crear pedido si order-ahead está habilitado en la tienda.
- Puede pagar sólo con wallet y cancelar en ventana permitida.
- Puede consultar saldo wallet, historial y puntos.

## 4. Reglas de disponibilidad order-ahead
Una tienda permite crear órdenes sólo si:
1. `order_ahead_enabled = true`.
2. Existe ventana de retiro válida (10 o 15 min) en horario activo.
3. Hay stock suficiente para todos los ítems.
4. Hay capacidad operativa (si se configura cupo por ventana).

## 5. Reglas de menú y stock
- Productos, precio y stock son específicos por tienda.
- Un ítem fuera de horario de venta en esa tienda no puede pedirse.
- El stock se valida al confirmar orden y se reserva al crearla.
- Si staff rechaza o cliente cancela, el stock reservado se libera.

## 6. Reglas de wallet
- Wallet representa dinero real prepago y no expira.
- Débito al crear orden (`ORDER_CREATED_DEBIT`).
- Crédito por reversión en cancelación/rechazo (`ORDER_REVERSAL_CREDIT`).
- No reversión en no-show v1.
- Toda operación wallet debe registrar:
  - `user_id`, `order_id` (si aplica), `amount`, `type`, `idempotency_key`, `created_at`.

## 7. Reglas de loyalty
- Acumulación de puntos por:
  1. orden,
  2. producto,
  3. ajuste manual.
- Cada regla de acumulación debe tener vigencia y tienda objetivo (global o específica).
- Canje v1: bebida gratis.
- El canje crea transacción de débito de puntos y evidencia de beneficio aplicado.

## 8. Reglas de auditoría
- Registrar actor, acción, timestamp y motivo en:
  - cambios de estado de orden,
  - cambios de configuración order-ahead,
  - ajustes manuales de puntos,
  - movimientos wallet.
- Eventos críticos deben ser trazables extremo a extremo con `correlation_id`.

## 9. Reglas de consistencia temporal
- El reloj de negocio es zona horaria de la tienda.
- Ventana de cancelación (5 min) se calcula contra `created_at` del servidor.
- Ventanas de pickup se cierran y evalúan con tiempo del servidor.
