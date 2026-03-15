# Máquina de Estados de Orden

## 1. Estados
- `PENDING_ACCEPTANCE`: orden creada, pagada con wallet, esperando decisión staff.
- `ACCEPTED`: orden aceptada y en preparación/lista para retiro.
- `REJECTED`: orden rechazada por staff; requiere reversión wallet.
- `CANCELLED_BY_CUSTOMER`: cancelada por cliente dentro de 5 min; requiere reversión wallet.
- `COMPLETED`: entregada al cliente.
- `NO_SHOW`: cliente no retiró en la ventana definida; sin reversión v1.

## 2. Transiciones permitidas
1. `PENDING_ACCEPTANCE -> ACCEPTED`
2. `PENDING_ACCEPTANCE -> REJECTED`
3. `PENDING_ACCEPTANCE -> CANCELLED_BY_CUSTOMER` (si <= 5 min)
4. `ACCEPTED -> COMPLETED`
5. `ACCEPTED -> NO_SHOW`

### Transiciones prohibidas (ejemplos)
- Cualquier estado terminal (`REJECTED`, `CANCELLED_BY_CUSTOMER`, `COMPLETED`, `NO_SHOW`) a otro estado.
- `PENDING_ACCEPTANCE -> COMPLETED` (salto inválido).
- `ACCEPTED -> REJECTED` (decisión staff ya consolidada).

## 3. Efectos de negocio por transición
### 3.1 Creación de orden (entrada a `PENDING_ACCEPTANCE`)
- Validar disponibilidad order-ahead en tienda.
- Validar stock y reservar.
- Debitar wallet (idempotente).
- Calcular puntos potenciales (pendientes de política de acreditación).

### 3.2 Rechazo (`PENDING_ACCEPTANCE -> REJECTED`)
- Liberar stock reservado.
- Acreditar reversión wallet por monto total.
- Registrar motivo de rechazo.

### 3.3 Cancelación (`PENDING_ACCEPTANCE -> CANCELLED_BY_CUSTOMER`)
- Validar ventana <= 5 min.
- Liberar stock reservado.
- Acreditar reversión wallet por monto total.
- Registrar actor cliente.

### 3.4 Aceptación (`PENDING_ACCEPTANCE -> ACCEPTED`)
- Registrar actor (barista/owner).
- Iniciar cronómetro operativo de preparación/retiro.

### 3.5 Entrega (`ACCEPTED -> COMPLETED`)
- Registrar entrega efectiva.
- Acreditar puntos según reglas (si la política define acreditación al completar).

### 3.6 No-show (`ACCEPTED -> NO_SHOW`)
- Registrar no retiro.
- Incrementar contador no-show del cliente.
- No generar reversión wallet en v1.

## 4. SLA y timeouts operativos recomendados
- `PENDING_ACCEPTANCE`: objetivo de decisión staff <= 2 minutos.
- Alerta operativa si una orden supera umbral de espera configurable.
- Marcado de `NO_SHOW` sólo después del fin de ventana + tolerancia operativa.

## 5. Requisitos técnicos de implementación
- Implementar guardas de transición en capa de dominio (no sólo UI).
- Persistir historial de estado (`order_state_history`) con actor y motivo.
- Publicar evento de dominio por cada transición:
  - `order.created`, `order.accepted`, `order.rejected`, `order.cancelled`, `order.completed`, `order.no_show`.
- Consumidores wallet/loyalty deben ser idempotentes por `event_id`.
